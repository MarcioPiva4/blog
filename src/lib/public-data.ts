import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray, ne, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { authors, categories, posts, postTags, tags } from "@/db/schema";
import { TAG_INDEX_MIN_POSTS } from "./config";

export const PAGE_SIZE = 12;

const listColumns = {
  id: posts.id,
  title: posts.title,
  slug: posts.slug,
  excerpt: posts.excerpt,
  coverImage: posts.coverImage,
  coverAlt: posts.coverAlt,
  publishedAt: posts.publishedAt,
  readingTime: posts.readingTime,
  categoryId: posts.categoryId,
};

export type PostCard = { id: number; title: string; slug: string; excerpt: string; coverImage: string | null; coverAlt: string | null; publishedAt: Date | null; readingTime: number; categoryId: number | null };

const isPublic = (blogId: number) => and(eq(posts.blogId, blogId), eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`));

export async function listPosts(blogId: number, opts: { page?: number; categoryId?: number; authorId?: number; tagId?: number; limit?: number } = {}) {
  const limit = opts.limit ?? PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const where = and(
    isPublic(blogId),
    opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined,
    opts.authorId ? eq(posts.authorId, opts.authorId) : undefined,
    opts.tagId ? inArray(posts.id, db.select({ id: postTags.postId }).from(postTags).where(eq(postTags.tagId, opts.tagId))) : undefined,
  );
  const [items, total] = await Promise.all([
    db.select(listColumns).from(posts).where(where).orderBy(desc(posts.publishedAt)).limit(limit).offset((page - 1) * limit),
    db.$count(posts, where),
  ]);
  return { items: items as PostCard[], total, pages: Math.max(1, Math.ceil(total / limit)), page };
}

/** Posts de uma categoria/tag (até 60, sem paginação; o resto é descoberto via sitemap). Dedup entre metadata e página. */
export const listTaxonomyPosts = cache((blogId: number, kind: "category" | "tag", id: number) =>
  listPosts(blogId, kind === "category" ? { categoryId: id, limit: 60 } : { tagId: id, limit: 60 }),
);

export const getPublicPost = cache(async (blogId: number, slug: string) => {
  const post = await db.query.posts.findFirst({
    where: and(isPublic(blogId), eq(posts.slug, slug)),
    with: { author: true, category: true, postTags: { with: { tag: true } } },
  });
  return post ?? null;
});

export async function relatedPosts(blogId: number, postId: number, categoryId: number | null, limit = 4) {
  const sameCat = categoryId
    ? await db.select(listColumns).from(posts).where(and(isPublic(blogId), ne(posts.id, postId), eq(posts.categoryId, categoryId))).orderBy(desc(posts.publishedAt)).limit(limit)
    : [];
  if (sameCat.length >= limit) return sameCat as PostCard[];
  const more = await db
    .select(listColumns)
    .from(posts)
    .where(and(isPublic(blogId), ne(posts.id, postId)))
    .orderBy(desc(posts.publishedAt))
    .limit(limit * 2);
  const seen = new Set(sameCat.map((p) => p.id));
  return [...sameCat, ...more.filter((p) => !seen.has(p.id))].slice(0, limit) as PostCard[];
}

export async function popularPosts(blogId: number, limit = 5) {
  const rows = (await db.execute(sql`
    select p.id, p.title, p.slug from daily_stats d join posts p on p.id = d.post_id
    where d.blog_id = ${blogId} and d.post_id > 0 and d.date >= current_date - 30 and p.status = 'published'
    group by p.id, p.title, p.slug order by sum(d.views) desc limit ${limit}`)) as unknown as { id: number; title: string; slug: string }[];
  return rows;
}

export async function sitemapEntries(blogId: number) {
  return db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt, publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(isPublic(blogId), eq(posts.noindex, false)))
    .orderBy(desc(posts.publishedAt));
}

/** Categorias com pelo menos 1 post indexável (categoria vazia é página rasa). */
export async function categorySitemapEntries(blogId: number) {
  return db
    .select({ slug: categories.slug, updatedAt: sql`max(${posts.updatedAt})`.mapWith(posts.updatedAt) })
    .from(categories)
    .innerJoin(posts, and(eq(posts.categoryId, categories.id), isPublic(blogId), eq(posts.noindex, false)))
    .where(eq(categories.blogId, blogId))
    .groupBy(categories.id)
    .orderBy(categories.position);
}

/** Tags com posts suficientes para serem indexadas. */
export async function tagSitemapEntries(blogId: number) {
  return db
    .select({ slug: tags.slug, updatedAt: sql`max(${posts.updatedAt})`.mapWith(posts.updatedAt) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, and(eq(posts.id, postTags.postId), isPublic(blogId), eq(posts.noindex, false)))
    .where(eq(tags.blogId, blogId))
    .groupBy(tags.id)
    .having(sql`count(*) >= ${TAG_INDEX_MIN_POSTS}`);
}

export const getCategoryBySlug = cache(async (blogId: number, slug: string) => {
  return (await db.query.categories.findFirst({ where: and(eq(categories.blogId, blogId), eq(categories.slug, slug)) })) ?? null;
});

export const getTagBySlug = cache(async (blogId: number, slug: string) => {
  return (await db.query.tags.findFirst({ where: and(eq(tags.blogId, blogId), eq(tags.slug, slug)) })) ?? null;
});

export async function getAuthorBySlug(blogId: number, slug: string) {
  return (await db.query.authors.findFirst({ where: and(eq(authors.blogId, blogId), eq(authors.slug, slug)) })) ?? null;
}

export async function listAuthors(blogId: number) {
  return db.select().from(authors).where(eq(authors.blogId, blogId));
}
