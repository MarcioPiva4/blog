import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, categories, posts, postTags, tags } from "@/db/schema";
import { TaxonomyManager, type TaxonomyTab } from "@/components/admin/taxonomy-manager";
import { EmptyState, PageHeader } from "@/components/ui";
import { TAG_INDEX_MIN_POSTS } from "@/lib/config";
import { blogBaseUrl } from "@/lib/tenant";

export const metadata = { title: "Categorias e tags" };

const postCount = sql<number>`count(${posts.id})::int`;
const publishedCount = sql<number>`(count(${posts.id}) filter (where ${posts.status} = 'published'))::int`;

export default async function TaxonomyPage({ searchParams }: { searchParams: Promise<{ blog?: string; tab?: string }> }) {
  const sp = await searchParams;
  const blogList = await db.select({ id: blogs.id, name: blogs.name, slug: blogs.slug, brandColor: blogs.brandColor }).from(blogs).orderBy(asc(blogs.id));
  if (!blogList.length) {
    return (
      <>
        <PageHeader title="Categorias e tags" />
        <EmptyState title="Crie um blog primeiro." />
      </>
    );
  }
  const blog = blogList.find((b) => b.id === Number(sp.blog)) ?? blogList[0];

  const [cats, tagRows, baseUrl] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, posts: postCount, published: publishedCount })
      .from(categories)
      .leftJoin(posts, eq(posts.categoryId, categories.id))
      .where(eq(categories.blogId, blog.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.position), asc(categories.id)),
    db
      .select({ id: tags.id, name: tags.name, slug: tags.slug, posts: postCount, published: publishedCount })
      .from(tags)
      .leftJoin(postTags, eq(postTags.tagId, tags.id))
      .leftJoin(posts, eq(posts.id, postTags.postId))
      .where(eq(tags.blogId, blog.id))
      .groupBy(tags.id)
      .orderBy(asc(tags.name)),
    blogBaseUrl(blog),
  ]);

  return (
    <>
      <PageHeader title="Categorias e tags" description="Organize os posts de cada blog em seções (categorias) e assuntos (tags)." />
      <TaxonomyManager
        key={blog.id}
        blogs={blogList}
        blogId={blog.id}
        baseUrl={baseUrl}
        categories={cats}
        tags={tagRows}
        tagIndexMin={TAG_INDEX_MIN_POSTS}
        initialTab={(sp.tab === "tags" ? "tags" : "categories") satisfies TaxonomyTab}
      />
    </>
  );
}
