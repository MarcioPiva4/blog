"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { authors, blogs, domains } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { RESERVED_SLUGS } from "@/lib/config";
import { revalidatePublic } from "@/lib/posts";
import { slugify } from "@/lib/utils";

const blogSchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "use só letras minúsculas, números e hífen")
    .refine((s) => !RESERVED_SLUGS.has(s), "slug reservado"),
  tagline: z.string().trim().default(""),
  description: z.string().trim().default(""),
  niche: z.string().trim().default(""),
  language: z.enum(["pt-BR", "en"]),
  theme: z.enum(["minimal", "magazine", "editorial"]),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  editorialGuide: z.string().default(""),
  postsPerDay: z.coerce.number().int().min(1).max(10),
  aiPostStatus: z.enum(["scheduled", "review"]),
  contactEmail: z.string().trim().email().or(z.literal("")).default(""),
  adsensePubId: z.string().trim().regex(/^(pub-\d{10,20})?$/, "formato pub-XXXXXXXXXXXXXXXX").default(""),
  adsEnabled: z.coerce.boolean().default(false),
  inContentAdAfter: z.coerce.number().int().min(0).max(20),
  affiliateDisclosure: z.string().default(""),
  logoUrl: z.string().trim().default(""),
});

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return blogSchema.safeParse({ ...raw, slug: slugify(String(raw.slug || raw.name || "")), adsEnabled: raw.adsEnabled === "on" });
}

function errorMessage(e: z.ZodError) {
  return e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ");
}

export async function createBlog(formData: FormData) {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) redirect(`/dashboard/blogs/new?error=${encodeURIComponent(errorMessage(parsed.error))}`);
  const data = parsed.data;
  const exists = await db.query.blogs.findFirst({ where: eq(blogs.slug, data.slug) });
  if (exists) redirect(`/dashboard/blogs/new?error=${encodeURIComponent("Já existe um blog com esse slug")}`);

  const [blog] = await db
    .insert(blogs)
    .values({ ...data, contactEmail: data.contactEmail || null, adsensePubId: data.adsensePubId || null, logoUrl: data.logoUrl || null })
    .returning();
  // Autoria padrão: nome de redação (não invente credenciais)
  await db.insert(authors).values({
    blogId: blog.id,
    name: data.language === "en" ? `${blog.name} Team` : `Equipe ${blog.name}`,
    slug: "redacao",
    bio: data.language === "en" ? `The editorial team behind ${blog.name}.` : `Equipe editorial do ${blog.name}.`,
  });
  redirect(`/dashboard/blogs/${blog.id}?saved=1`);
}

export async function updateBlog(id: number, formData: FormData) {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) redirect(`/dashboard/blogs/${id}?error=${encodeURIComponent(errorMessage(parsed.error))}`);
  const data = parsed.data;
  const clash = await db.query.blogs.findFirst({ where: eq(blogs.slug, data.slug) });
  if (clash && clash.id !== id) redirect(`/dashboard/blogs/${id}?error=${encodeURIComponent("Slug em uso por outro blog")}`);
  await db
    .update(blogs)
    .set({ ...data, contactEmail: data.contactEmail || null, adsensePubId: data.adsensePubId || null, logoUrl: data.logoUrl || null })
    .where(eq(blogs.id, id));
  revalidatePublic();
  redirect(`/dashboard/blogs/${id}?saved=1`);
}

export async function toggleArchiveBlog(id: number) {
  await requireAdmin();
  const blog = await db.query.blogs.findFirst({ where: eq(blogs.id, id) });
  if (!blog) return;
  await db.update(blogs).set({ archived: !blog.archived }).where(eq(blogs.id, id));
  revalidatePublic();
  redirect(`/dashboard/blogs/${id}`);
}

// ---------- Domínios ----------
export async function addDomain(blogId: number, formData: FormData) {
  await requireAdmin();
  const hostname = String(formData.get("hostname") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname)) redirect(`/dashboard/blogs/${blogId}?error=${encodeURIComponent("Domínio inválido")}`);
  const isPrimary = formData.get("isPrimary") === "on";
  if (isPrimary) await db.update(domains).set({ isPrimary: false }).where(eq(domains.blogId, blogId));
  await db.insert(domains).values({ blogId, hostname, isPrimary }).onConflictDoNothing();
  revalidatePublic();
  redirect(`/dashboard/blogs/${blogId}?saved=1#dominios`);
}

export async function setPrimaryDomain(blogId: number, domainId: number) {
  await requireAdmin();
  await db.update(domains).set({ isPrimary: false }).where(eq(domains.blogId, blogId));
  await db.update(domains).set({ isPrimary: true, redirectTo: null }).where(and(eq(domains.id, domainId), eq(domains.blogId, blogId)));
  revalidatePublic();
  redirect(`/dashboard/blogs/${blogId}#dominios`);
}

/** Migração: o domínio passa a responder 301 para o domínio primário atual. */
export async function redirectDomainToPrimary(blogId: number, domainId: number) {
  await requireAdmin();
  const primary = await db.query.domains.findFirst({ where: and(eq(domains.blogId, blogId), eq(domains.isPrimary, true)) });
  const blog = await db.query.blogs.findFirst({ where: eq(blogs.id, blogId) });
  const target = primary?.hostname ?? `${blog?.slug}.${process.env.ROOT_DOMAIN ?? "localhost"}`;
  await db.update(domains).set({ redirectTo: target, isPrimary: false }).where(and(eq(domains.id, domainId), eq(domains.blogId, blogId)));
  revalidatePublic();
  redirect(`/dashboard/blogs/${blogId}#dominios`);
}

export async function deleteDomain(blogId: number, domainId: number) {
  await requireAdmin();
  await db.delete(domains).where(and(eq(domains.id, domainId), eq(domains.blogId, blogId)));
  revalidatePublic();
  redirect(`/dashboard/blogs/${blogId}#dominios`);
}

// ---------- Autores ----------
export async function saveAuthor(blogId: number, formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) redirect(`/dashboard/blogs/${blogId}?error=${encodeURIComponent("Nome do autor muito curto")}#autores`);
  const values = {
    name,
    slug: slugify(String(formData.get("slug") || name)),
    bio: String(formData.get("bio") ?? ""),
    expertise: String(formData.get("expertise") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? "") || null,
  };
  if (id) await db.update(authors).set(values).where(and(eq(authors.id, id), eq(authors.blogId, blogId)));
  else await db.insert(authors).values({ ...values, blogId }).onConflictDoNothing();
  revalidatePublic();
  redirect(`/dashboard/blogs/${blogId}#autores`);
}
