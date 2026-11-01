import { PostEditor } from "@/components/admin/post-editor";
import { EmptyState, PageHeader } from "@/components/ui";
import { loadEditorBlogs } from "../editor-data";

export const metadata = { title: "Novo post" };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ blog?: string }> }) {
  const { blog } = await searchParams;
  const blogs = await loadEditorBlogs();
  return (
    <>
      <PageHeader title="Novo post" />
      {blogs.length ? <PostEditor blogs={blogs} defaultBlogId={blog ? Number(blog) : undefined} /> : <EmptyState title="Crie um blog primeiro." />}
    </>
  );
}
