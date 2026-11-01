"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, postTags, tags } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { revalidatePublic } from "@/lib/posts";
import { slugify } from "@/lib/utils";

const id = z.number().int().positive();

const categoryInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(2, "O nome precisa ter pelo menos 2 letras").max(60, "Nome muito longo (máx. 60 caracteres)"),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(300, "Descrição muito longa (máx. 300 caracteres)").default(""),
});

const tagInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Digite o nome da tag").max(40, "Nome muito longo (máx. 40 caracteres)"),
  slug: z.string().trim().max(80).optional(),
});

const fail = (error: string): ActionResult => ({ ok: false, error });
const issue = (e: z.ZodError) => fail(e.issues[0]?.message ?? "Dados inválidos");

// ---------- Categorias ----------
export async function saveCategoryAction(blogId: number, raw: z.input<typeof categoryInput>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = categoryInput.safeParse(raw);
  if (!parsed.success) return issue(parsed.error);
  const { id: categoryId, name, description } = parsed.data;
  const slug = slugify(parsed.data.slug || name);
  if (!slug) return fail("O nome precisa ter letras ou números");

  const clash = await db.query.categories.findFirst({ where: and(eq(categories.blogId, blogId), eq(categories.slug, slug)) });
  if (clash && clash.id !== categoryId) return fail(`Já existe a categoria "${clash.name}" com o endereço /categoria/${slug}`);

  if (categoryId) {
    const [row] = await db
      .update(categories)
      .set({ name, slug, description })
      .where(and(eq(categories.id, categoryId), eq(categories.blogId, blogId)))
      .returning({ id: categories.id });
    if (!row) return fail("Categoria não encontrada");
  } else {
    const position = await db.$count(categories, eq(categories.blogId, blogId));
    await db.insert(categories).values({ blogId, name, slug, description, position });
  }
  revalidatePublic();
  return { ok: true, message: categoryId ? "Categoria atualizada" : `Categoria "${name}" criada` };
}

/** Recebe a lista completa de ids na nova ordem (ordem do menu do blog). */
export async function reorderCategoriesAction(blogId: number, ids: number[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(id).safeParse(ids);
  if (!parsed.success) return fail("Ordem inválida");
  const current = await db.select({ id: categories.id }).from(categories).where(eq(categories.blogId, blogId));
  const same = current.length === parsed.data.length && current.every((c) => parsed.data.includes(c.id));
  if (!same) return fail("A lista mudou em outra aba. Recarregue a página.");
  await db.transaction(async (tx) => {
    for (const [position, categoryId] of parsed.data.entries()) await tx.update(categories).set({ position }).where(eq(categories.id, categoryId));
  });
  revalidatePublic();
  return { ok: true, message: "Ordem do menu salva" };
}

export async function deleteCategoryAction(blogId: number, categoryId: number): Promise<ActionResult> {
  await requireAdmin();
  // Posts da categoria ficam "sem categoria" (FK on delete set null)
  const [row] = await db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.blogId, blogId)))
    .returning({ name: categories.name });
  if (!row) return fail("Categoria não encontrada");
  revalidatePublic();
  return { ok: true, message: `Categoria "${row.name}" excluída` };
}

// ---------- Tags ----------
/** Cria várias de uma vez; as que já existem são ignoradas. */
export async function createTagsAction(blogId: number, names: string[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(tagInput.shape.name).min(1, "Digite pelo menos uma tag").max(50).safeParse(names);
  if (!parsed.success) return issue(parsed.error);
  const unique = [...new Map(parsed.data.map((n) => [slugify(n), n])).entries()].filter(([slug]) => slug);
  if (!unique.length) return fail("As tags precisam ter letras ou números");

  const created = await db
    .insert(tags)
    .values(unique.map(([slug, name]) => ({ blogId, slug, name })))
    .onConflictDoNothing()
    .returning({ name: tags.name });
  const skipped = unique.length - created.length;
  if (!created.length) return fail(unique.length === 1 ? "Essa tag já existe" : "Todas essas tags já existem");
  revalidatePublic();
  const msg = created.length === 1 ? `Tag #${created[0].name} criada` : `${created.length} tags criadas`;
  return { ok: true, message: skipped ? `${msg} (${skipped} já existia${skipped > 1 ? "m" : ""})` : msg };
}

/** Renomeia. Se o novo nome já for de outra tag, une as duas (os posts passam para a existente). */
export async function saveTagAction(blogId: number, raw: z.input<typeof tagInput>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = tagInput.safeParse(raw);
  if (!parsed.success) return issue(parsed.error);
  const { id: tagId, name } = parsed.data;
  if (!tagId) return createTagsAction(blogId, [name]);
  const slug = slugify(parsed.data.slug || name);
  if (!slug) return fail("A tag precisa ter letras ou números");

  const own = await db.query.tags.findFirst({ where: and(eq(tags.id, tagId), eq(tags.blogId, blogId)) });
  if (!own) return fail("Tag não encontrada");
  const clash = await db.query.tags.findFirst({ where: and(eq(tags.blogId, blogId), eq(tags.slug, slug)) });

  if (clash && clash.id !== own.id) {
    await db.transaction(async (tx) => {
      const rows = await tx.select({ postId: postTags.postId }).from(postTags).where(eq(postTags.tagId, own.id));
      if (rows.length) await tx.insert(postTags).values(rows.map((r) => ({ postId: r.postId, tagId: clash.id }))).onConflictDoNothing();
      await tx.delete(tags).where(eq(tags.id, own.id));
    });
    revalidatePublic();
    return { ok: true, message: `#${own.name} foi unida a #${clash.name}` };
  }

  await db.update(tags).set({ name, slug }).where(eq(tags.id, own.id));
  revalidatePublic();
  return { ok: true, message: "Tag atualizada" };
}

export async function deleteTagAction(blogId: number, tagId: number): Promise<ActionResult> {
  await requireAdmin();
  const [row] = await db.delete(tags).where(and(eq(tags.id, tagId), eq(tags.blogId, blogId))).returning({ name: tags.name });
  if (!row) return fail("Tag não encontrada");
  revalidatePublic();
  return { ok: true, message: `Tag #${row.name} excluída` };
}
