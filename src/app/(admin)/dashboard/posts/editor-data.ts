import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { blogs, categories, tags } from "@/db/schema";
import { blogBaseUrl } from "@/lib/tenant";
import type { EditorBlog } from "@/components/admin/post-editor";

export async function loadEditorBlogs(): Promise<EditorBlog[]> {
  const [list, cats, tagRows] = await Promise.all([
    db.select().from(blogs).orderBy(asc(blogs.id)),
    db.select({ id: categories.id, name: categories.name, blogId: categories.blogId }).from(categories).orderBy(asc(categories.position), asc(categories.id)),
    db.select({ name: tags.name, blogId: tags.blogId }).from(tags).orderBy(asc(tags.name)),
  ]);
  return Promise.all(
    list.map(async (b) => ({
      id: b.id,
      name: b.name,
      baseUrl: await blogBaseUrl(b),
      categories: cats.filter((c) => c.blogId === b.id).map(({ id, name }) => ({ id, name })),
      tags: tagRows.filter((t) => t.blogId === b.id).map((t) => t.name),
    })),
  );
}
