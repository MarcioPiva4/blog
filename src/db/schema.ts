import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export type BlogTheme = "minimal" | "magazine" | "editorial";
export type BlogLanguage = "pt-BR" | "en";
export type PostStatus = "draft" | "review" | "scheduled" | "published" | "archived";
export type TopicStatus = "idea" | "assigned" | "written" | "published" | "discarded";
export type FaqItem = { question: string; answer: string };
export type AffiliateProduct = { name: string; url: string; image?: string; price?: string; note?: string };

export const blogs = pgTable("blogs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  tagline: text().notNull().default(""),
  description: text().notNull().default(""),
  niche: text().notNull().default(""),
  language: text().$type<BlogLanguage>().notNull().default("pt-BR"),
  /** Guia editorial lido pela IA via MCP: público, tom, regras, fontes. */
  editorialGuide: text().notNull().default(""),
  theme: text().$type<BlogTheme>().notNull().default("minimal"),
  brandColor: text().notNull().default("#4f46e5"),
  logoUrl: text(),
  faviconUrl: text(),
  adsensePubId: text(),
  adsEnabled: boolean().notNull().default(false),
  inContentAdAfter: integer().notNull().default(3),
  /** Status inicial de posts criados pela IA. */
  aiPostStatus: text().$type<"scheduled" | "review">().notNull().default("scheduled"),
  postsPerDay: integer().notNull().default(1),
  contactEmail: text(),
  affiliateDisclosure: text().notNull().default(""),
  archived: boolean().notNull().default(false),
  ...timestamps,
});

export const domains = pgTable("domains", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  blogId: integer()
    .notNull()
    .references(() => blogs.id, { onDelete: "cascade" }),
  hostname: text().notNull().unique(),
  isPrimary: boolean().notNull().default(false),
  /** Quando preenchido, este domínio responde 301 para o host indicado (migração). */
  redirectTo: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const authors = pgTable(
  "authors",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer()
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull(),
    bio: text().notNull().default(""),
    avatarUrl: text(),
    expertise: text().notNull().default(""),
    links: jsonb().$type<Record<string, string>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.blogId, t.slug)],
);

export const categories = pgTable(
  "categories",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer()
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull(),
    description: text().notNull().default(""),
    position: integer().notNull().default(0),
  },
  (t) => [uniqueIndex().on(t.blogId, t.slug)],
);

export const tags = pgTable(
  "tags",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer()
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull(),
  },
  (t) => [uniqueIndex().on(t.blogId, t.slug)],
);

export const posts = pgTable(
  "posts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer()
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    authorId: integer().references(() => authors.id, { onDelete: "set null" }),
    categoryId: integer().references(() => categories.id, { onDelete: "set null" }),
    title: text().notNull(),
    slug: text().notNull(),
    excerpt: text().notNull().default(""),
    contentMd: text().notNull().default(""),
    coverImage: text(),
    coverAlt: text(),
    status: text().$type<PostStatus>().notNull().default("draft"),
    publishAt: timestamp({ withTimezone: true }),
    publishedAt: timestamp({ withTimezone: true }),
    seoTitle: text(),
    metaDescription: text(),
    focusKeyword: text(),
    secondaryKeywords: text().array().notNull().default(sql`'{}'::text[]`),
    canonicalUrl: text(),
    noindex: boolean().notNull().default(false),
    faq: jsonb().$type<FaqItem[]>().notNull().default([]),
    affiliateProducts: jsonb().$type<AffiliateProduct[]>().notNull().default([]),
    sources: jsonb().$type<{ title: string; url: string }[]>().notNull().default([]),
    seoScore: integer().notNull().default(0),
    wordCount: integer().notNull().default(0),
    readingTime: integer().notNull().default(1),
    source: text().$type<"manual" | "mcp">().notNull().default("manual"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex().on(t.blogId, t.slug),
    index().on(t.blogId, t.status, t.publishedAt),
    index().on(t.status, t.publishAt),
  ],
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: integer()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer()
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const postRevisions = pgTable(
  "post_revisions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    postId: integer()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    title: text().notNull(),
    contentMd: text().notNull(),
    snapshot: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    source: text().$type<"manual" | "mcp">().notNull().default("manual"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.postId)],
);

export const media = pgTable("media", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  blogId: integer().references(() => blogs.id, { onDelete: "set null" }),
  path: text().notNull(),
  url: text().notNull(),
  alt: text().notNull().default(""),
  width: integer(),
  height: integer(),
  mime: text().notNull(),
  size: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const topicQueue = pgTable(
  "topic_queue",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer()
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    keyword: text().notNull(),
    title: text().notNull().default(""),
    intent: text().notNull().default(""),
    cluster: text().notNull().default(""),
    priority: integer().notNull().default(0),
    status: text().$type<TopicStatus>().notNull().default("idea"),
    postId: integer().references(() => posts.id, { onDelete: "set null" }),
    notes: text().notNull().default(""),
    assignedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.blogId, t.status, t.priority), uniqueIndex().on(t.blogId, t.keyword)],
);

export const adSlots = pgTable("ad_slots", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  blogId: integer()
    .notNull()
    .references(() => blogs.id, { onDelete: "cascade" }),
  position: text().$type<"header" | "in_content" | "sidebar" | "end_post" | "sticky_mobile">().notNull(),
  network: text().notNull().default("adsense"),
  code: text().notNull().default(""),
  enabled: boolean().notNull().default(true),
});

export const pageViews = pgTable(
  "page_views",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer().notNull(),
    postId: integer(),
    path: text().notNull(),
    referrerHost: text(),
    country: text(),
    device: text().$type<"mobile" | "desktop" | "tablet">(),
    sessionHash: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.blogId, t.createdAt), index().on(t.createdAt)],
);

/** postId = 0 representa o total do blog. */
export const dailyStats = pgTable(
  "daily_stats",
  {
    blogId: integer().notNull(),
    postId: integer().notNull().default(0),
    date: date().notNull(),
    views: integer().notNull().default(0),
    uniques: integer().notNull().default(0),
    topReferrers: jsonb().$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.blogId, t.postId, t.date] })],
);

export const gscStats = pgTable(
  "gsc_stats",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    blogId: integer().notNull(),
    date: date().notNull(),
    page: text().notNull(),
    query: text().notNull(),
    clicks: integer().notNull().default(0),
    impressions: integer().notNull().default(0),
    ctr: real().notNull().default(0),
    position: real().notNull().default(0),
  },
  (t) => [uniqueIndex().on(t.blogId, t.date, t.page, t.query)],
);

export const revenueDaily = pgTable(
  "revenue_daily",
  {
    blogId: integer().notNull(),
    date: date().notNull(),
    source: text().notNull(),
    pageViews: integer().notNull().default(0),
    impressions: integer().notNull().default(0),
    clicks: integer().notNull().default(0),
    earnings: numeric({ precision: 12, scale: 4 }).notNull().default("0"),
    currency: text().notNull().default("BRL"),
  },
  (t) => [primaryKey({ columns: [t.blogId, t.date, t.source] })],
);

export const apiKeys = pgTable("api_keys", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  prefix: text().notNull(),
  keyHash: text().notNull().unique(),
  lastUsedAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const mcpLogs = pgTable(
  "mcp_logs",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    apiKeyId: integer().references(() => apiKeys.id, { onDelete: "set null" }),
    tool: text().notNull(),
    args: jsonb().$type<unknown>(),
    ok: boolean().notNull(),
    result: text().notNull().default(""),
    durationMs: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.createdAt)],
);

export const blogsRelations = relations(blogs, ({ many }) => ({
  domains: many(domains),
  authors: many(authors),
  categories: many(categories),
  posts: many(posts),
}));

export const domainsRelations = relations(domains, ({ one }) => ({
  blog: one(blogs, { fields: [domains.blogId], references: [blogs.id] }),
}));

export const authorsRelations = relations(authors, ({ one }) => ({
  blog: one(blogs, { fields: [authors.blogId], references: [blogs.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  blog: one(blogs, { fields: [categories.blogId], references: [blogs.id] }),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  blog: one(blogs, { fields: [posts.blogId], references: [blogs.id] }),
  author: one(authors, { fields: [posts.authorId], references: [authors.id] }),
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  postTags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export type Blog = typeof blogs.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Author = typeof authors.$inferSelect;
export type Topic = typeof topicQueue.$inferSelect;
