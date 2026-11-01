import { PostList, Pagination } from "@/components/site/post-list";
import { t } from "@/lib/i18n";
import { listPosts } from "@/lib/public-data";
import { loadTenant } from "@/lib/site";

export const revalidate = 3600;

export default async function SiteHome({ params }: { params: Promise<{ domain: string }> }) {
  const tenant = await loadTenant((await params).domain, "/");
  const { blog, categories } = tenant;
  const d = t(blog.language);
  const { items, page, pages } = await listPosts(blog.id, { page: 1 });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {blog.theme !== "magazine" && (
        <section className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className={`text-3xl font-bold tracking-tight md:text-4xl ${blog.theme === "editorial" ? "font-serif" : ""}`}>{blog.name}</h1>
          {blog.tagline && <p className="mt-3 text-lg text-zinc-600">{blog.tagline}</p>}
        </section>
      )}
      {blog.theme === "magazine" && <h1 className="sr-only">{blog.name}</h1>}
      {items.length ? (
        <PostList theme={blog.theme} posts={items} categories={categories} d={d} locale={blog.language} />
      ) : (
        <p className="py-20 text-center text-zinc-500">{d.noPosts}</p>
      )}
      <Pagination page={page} pages={pages} base="" d={d} />
    </main>
  );
}
