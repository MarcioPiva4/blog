import "server-only";
import { and, desc, eq, ne, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { blogs, categories, postRevisions, posts, postTags, tags, topicQueue, type Post } from "@/db/schema";
import { analyzeSeo } from "./seo/score";
import { countWords, makeExcerpt, readingTime } from "./text";
import { slugify } from "./utils";
import { blogBaseUrl } from "./tenant";
import { pingIndexNow } from "./indexnow";
import { RESERVED_POST_SLUGS } from "./institutional";

export const POST_STATUSES = ["draft", "review", "scheduled", "published", "archived"] as const;

const faqSchema = z.object({ question: z.string().min(3), answer: z.string().min(3) });
const affiliateSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  image: z.string().optional(),
  price: z.string().optional(),
  note: z.string().optional(),
});
const sourceSchema = z.object({ title: z.string().min(1), url: z.string().url() });

export const postInputSchema = z.object({
  blogId: z.number().int().positive(),
  title: z.string().trim().min(5).max(200),
  slug: z.string().trim().max(100).optional(),
  contentMd: z.string().min(1),
  excerpt: z.string().trim().max(320).optional(),
  status: z.enum(POST_STATUSES).optional(),
  publishAt: z.coerce.date().nullish(),
  seoTitle: z.string().trim().max(120).nullish(),
  metaDescription: z.string().trim().max(320).nullish(),
  focusKeyword: z.string().trim().max(120).nullish(),
  secondaryKeywords: z.array(z.string().trim()).max(20).optional(),
  categoryId: z.number().int().nullish(),
  categorySlug: z.string().nullish(),
  tags: z.array(z.string().trim().min(1)).max(15).optional(),
  authorId: z.number().int().nullish(),
  coverImage: z.string().nullish(),
  coverAlt: z.string().nullish(),
  faq: z.array(faqSchema).max(15).optional(),
  affiliateProducts: z.array(affiliateSchema).max(12).optional(),
  sources: z.array(sourceSchema).max(20).optional(),
  canonicalUrl: z.string().url().nullish(),
  noindex: z.boolean().optional(),
  topicId: z.number().int().nullish(),
});

/** Entrada aceita (antes do parse): publishAt pode ser Date ou string ISO. */
export type PostInput = z.input<typeof postInputSchema>;

/** Invalida o cache ISR de todos os blogs públicos. */
export function revalidatePublic() {
  try {
    revalidatePath("/sites/[domain]", "layout");
  } catch {
    // fora do runtime do Next (ex.: seed) não há cache a invalidar
  }
}

async function uniqueSlug(blogId: number, wanted: string, exceptId?: number) {
  let base = slugify(wanted) || "post";
  if (RESERVED_POST_SLUGS.has(base)) base = `${base}-post`;
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const clash = await db.query.posts.findFirst({
      columns: { id: true },
      where: and(eq(posts.blogId, blogId), eq(posts.slug, slug), exceptId ? ne(posts.id, exceptId) : undefined),
    });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/** Próximo horário livre: depois do último agendado, espaçado por 24h / postsPerDay. */
export async function nextPublishSlot(blogId: number) {
  const blog = await db.query.blogs.findFirst({ where: eq(blogs.id, blogId) });
  const gapMs = (24 / Math.max(1, blog?.postsPerDay ?? 1)) * 3600_000;
  const last = await db.query.posts.findFirst({
    columns: { publishAt: true },
    where: and(eq(posts.blogId, blogId), eq(posts.status, "scheduled")),
    orderBy: desc(posts.publishAt),
  });
  const soonest = Date.now() + 3600_000;
  const candidate = last?.publishAt ? last.publishAt.getTime() + gapMs : soonest;
  return new Date(Math.max(candidate, soonest));
}

async function syncTags(blogId: number, postId: number, names: string[]) {
  await db.delete(postTags).where(eq(postTags.postId, postId));
  const unique = [...new Map(names.map((n) => [slugify(n), n])).entries()].filter(([s]) => s);
  if (!unique.length) return;
  await db
    .insert(tags)
    .values(unique.map(([slug, name]) => ({ blogId, slug, name })))
    .onConflictDoNothing();
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.blogId, blogId), inArray(tags.slug, unique.map(([s]) => s))));
  await db.insert(postTags).values(rows.map((r) => ({ postId, tagId: r.id })));
}

export type SaveResult = { post: Post; seo: ReturnType<typeof analyzeSeo>; warnings: string[]; url: string };

export async function savePost(raw: PostInput, opts: { id?: number; source: "manual" | "mcp" }): Promise<SaveResult> {
  const input = postInputSchema.parse(raw);
  const warnings: string[] = [];

  const blog = await db.query.blogs.findFirst({ where: eq(blogs.id, input.blogId) });
  if (!blog) throw new Error(`Blog ${input.blogId} não existe`);

  const existing = opts.id ? await db.query.posts.findFirst({ where: eq(posts.id, opts.id) }) : undefined;
  if (opts.id && !existing) throw new Error(`Post ${opts.id} não existe`);
  if (existing && existing.blogId !== input.blogId) throw new Error("Post pertence a outro blog");

  // Categoria por id ou slug, sempre do mesmo blog
  let categoryId: number | null = null;
  if (input.categoryId || input.categorySlug) {
    const cat = await db.query.categories.findFirst({
      where: and(
        eq(categories.blogId, blog.id),
        input.categoryId ? eq(categories.id, input.categoryId) : eq(categories.slug, slugify(input.categorySlug!)),
      ),
    });
    if (cat) categoryId = cat.id;
    else warnings.push("Categoria não encontrada neste blog; post salvo sem categoria.");
  }

  const finalCategoryId = categoryId ?? (input.categoryId === null ? null : existing?.categoryId ?? null);
  const slug = await uniqueSlug(blog.id, input.slug || existing?.slug || input.title, existing?.id);
  const words = countWords(input.contentMd);
  const seo = analyzeSeo({
    title: input.title,
    seoTitle: input.seoTitle,
    metaDescription: input.metaDescription,
    slug,
    focusKeyword: input.focusKeyword,
    contentMd: input.contentMd,
    coverImage: input.coverImage,
    faqCount: input.faq?.length ?? 0,
    hasCategory: finalCategoryId !== null,
  });

  // Regras de status / data
  let status = input.status ?? existing?.status ?? "draft";
  let publishAt = input.publishAt ?? existing?.publishAt ?? null;
  let publishedAt = existing?.publishedAt ?? null;
  if (status === "scheduled") {
    if (!publishAt) publishAt = await nextPublishSlot(blog.id);
    if (publishAt.getTime() <= Date.now()) status = "published";
  }
  if (status === "published" && !publishedAt) publishedAt = publishAt && publishAt.getTime() <= Date.now() ? publishAt : new Date();

  if (opts.source === "mcp" && words < 600) warnings.push(`Texto curto (${words} palavras). Recomendado 800+.`);
  if (seo.score < 60) warnings.push(`Score SEO baixo (${seo.score}). Veja os checks que falharam.`);

  const values = {
    blogId: blog.id,
    authorId: input.authorId ?? existing?.authorId ?? null,
    categoryId: finalCategoryId,
    title: input.title,
    slug,
    excerpt: input.excerpt || makeExcerpt(input.contentMd),
    contentMd: input.contentMd,
    coverImage: input.coverImage ?? null,
    coverAlt: input.coverAlt ?? null,
    status,
    publishAt,
    publishedAt,
    seoTitle: input.seoTitle || null,
    metaDescription: input.metaDescription || null,
    focusKeyword: input.focusKeyword || null,
    secondaryKeywords: input.secondaryKeywords ?? existing?.secondaryKeywords ?? [],
    canonicalUrl: input.canonicalUrl || null,
    noindex: input.noindex ?? existing?.noindex ?? false,
    faq: input.faq ?? existing?.faq ?? [],
    affiliateProducts: input.affiliateProducts ?? existing?.affiliateProducts ?? [],
    sources: input.sources ?? existing?.sources ?? [],
    seoScore: seo.score,
    wordCount: words,
    readingTime: readingTime(words),
  };

  let post: Post;
  if (existing) {
    await db.insert(postRevisions).values({
      postId: existing.id,
      title: existing.title,
      contentMd: existing.contentMd,
      snapshot: { seoTitle: existing.seoTitle, metaDescription: existing.metaDescription, status: existing.status },
      source: opts.source,
    });
    [post] = await db.update(posts).set(values).where(eq(posts.id, existing.id)).returning();
  } else {
    if (!values.authorId) {
      const author = await db.query.authors.findFirst({ where: (a, { eq }) => eq(a.blogId, blog.id) });
      values.authorId = author?.id ?? null;
    }
    [post] = await db.insert(posts).values({ ...values, source: opts.source }).returning();
  }

  if (input.tags) await syncTags(blog.id, post.id, input.tags);

  if (input.topicId) {
    await db
      .update(topicQueue)
      .set({ status: post.status === "published" ? "published" : "written", postId: post.id })
      .where(and(eq(topicQueue.id, input.topicId), eq(topicQueue.blogId, blog.id)));
  }

  const baseUrl = await blogBaseUrl(blog);
  const url = `${baseUrl}/${post.slug}`;
  const becamePublic = post.status === "published" || existing?.status === "published";
  if (becamePublic) revalidatePublic();
  if (post.status === "published" && existing?.status !== "published") await pingIndexNow([url]);

  return { post, seo, warnings, url };
}

/** Publica posts agendados cujo horário chegou. Chamado pelo cron. */
export async function publishDuePosts() {
  const due = await db
    .update(posts)
    .set({ status: "published", publishedAt: sql`coalesce(${posts.publishAt}, now())` })
    .where(and(eq(posts.status, "scheduled"), sql`${posts.publishAt} <= now()`))
    .returning({ id: posts.id, slug: posts.slug, blogId: posts.blogId });

  if (due.length) {
    await db
      .update(topicQueue)
      .set({ status: "published" })
      .where(inArray(topicQueue.postId, due.map((d) => d.id)));
    revalidatePublic();
    const urls: string[] = [];
    for (const p of due) {
      const blog = await db.query.blogs.findFirst({ where: eq(blogs.id, p.blogId) });
      if (blog) urls.push(`${await blogBaseUrl(blog)}/${p.slug}`);
    }
    await pingIndexNow(urls);
  }
  return due;
}
