"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { categories, postRevisions, posts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { saveImage } from "@/lib/media";
import { revalidatePublic, savePost, type PostInput } from "@/lib/posts";
import { slugify } from "@/lib/utils";

export type SaveState = { ok: true; id: number; url: string; score: number; warnings: string[] } | { ok: false; error: string };

export async function savePostAction(id: number | null, input: PostInput): Promise<SaveState> {
  await requireAdmin();
  try {
    const { post, url, seo, warnings } = await savePost(input, { id: id ?? undefined, source: "manual" });
    return { ok: true, id: post.id, url, score: seo.score, warnings };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") };
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar" };
  }
}

export async function deletePostAction(id: number) {
  await requireAdmin();
  const [row] = await db.delete(posts).where(eq(posts.id, id)).returning({ status: posts.status });
  if (row?.status === "published") revalidatePublic();
  redirect("/dashboard/posts");
}

/** Cria categoria direto do editor; se o slug já existir no blog, devolve a existente. */
export async function createCategoryAction(blogId: number, rawName: string): Promise<{ ok: true; category: { id: number; name: string } } | { ok: false; error: string }> {
  await requireAdmin();
  const name = rawName.trim();
  const slug = slugify(name);
  if (name.length < 2 || !slug) return { ok: false, error: "Nome da categoria muito curto" };
  if (name.length > 60) return { ok: false, error: "Nome da categoria muito longo (máx. 60)" };
  const existing = await db.query.categories.findFirst({ where: and(eq(categories.blogId, blogId), eq(categories.slug, slug)) });
  if (existing) return { ok: true, category: { id: existing.id, name: existing.name } };
  const position = await db.$count(categories, eq(categories.blogId, blogId));
  const [row] = await db.insert(categories).values({ blogId, name, slug, position }).returning({ id: categories.id, name: categories.name });
  revalidatePublic();
  return { ok: true, category: row };
}

export async function previewMarkdownAction(md: string) {
  await requireAdmin();
  return renderMarkdown(md).html;
}

export async function uploadImageAction(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Selecione uma imagem" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Arquivo não é imagem" };
  try {
    const row = await saveImage(Buffer.from(await file.arrayBuffer()), {
      name: file.name.replace(/\.[^.]+$/, ""),
      alt: String(formData.get("alt") ?? ""),
      blogId: Number(formData.get("blogId")) || null,
    });
    return { ok: true, url: row.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha no upload" };
  }
}

export async function restoreRevisionAction(postId: number, revisionId: number) {
  await requireAdmin();
  const rev = await db.query.postRevisions.findFirst({ where: eq(postRevisions.id, revisionId) });
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!rev || !post || rev.postId !== postId) return;
  await savePost(
    {
      blogId: post.blogId,
      title: rev.title,
      contentMd: rev.contentMd,
      slug: post.slug,
      seoTitle: post.seoTitle,
      metaDescription: post.metaDescription,
      focusKeyword: post.focusKeyword,
      coverImage: post.coverImage,
      coverAlt: post.coverAlt,
    },
    { id: postId, source: "manual" },
  );
  redirect(`/dashboard/posts/${postId}`);
}
