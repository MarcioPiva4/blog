import { BlogForm } from "@/components/admin/blog-form";
import { Flash } from "@/components/admin/flash";
import { PageHeader } from "@/components/ui";
import { config } from "@/lib/config";
import { createBlog } from "../actions";

export const metadata = { title: "Novo blog" };

export default async function NewBlogPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <PageHeader title="Novo blog" />
      <Flash error={error} />
      <BlogForm action={createBlog} rootDomain={config.rootDomain} />
    </>
  );
}
