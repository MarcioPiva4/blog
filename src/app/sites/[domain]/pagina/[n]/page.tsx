import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostList, Pagination } from "@/components/site/post-list";
import { t } from "@/lib/i18n";
import { listPosts } from "@/lib/public-data";
import { loadTenant } from "@/lib/site";

export const revalidate = 3600;
export const generateStaticParams = () => [];

type Params = { params: Promise<{ domain: string; n: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { n } = await params;
  return { title: `Página ${n}`, alternates: { canonical: `/pagina/${n}` } };
}

export default async function SitePage({ params }: Params) {
  const { domain, n } = await params;
  const pageNum = Number(n);
  if (!Number.isInteger(pageNum) || pageNum < 2) notFound();
  const tenant = await loadTenant(domain, `/pagina/${n}`);
  const d = t(tenant.blog.language);
  const { items, page, pages } = await listPosts(tenant.blog.id, { page: pageNum });
  if (!items.length) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-center text-2xl font-bold">
        {d.latest} · {d.page} {page}
      </h1>
      <PostList theme={tenant.blog.theme === "magazine" ? "magazine" : "minimal"} posts={items} categories={tenant.categories} d={d} locale={tenant.blog.language} />
      <Pagination page={page} pages={pages} base="" d={d} />
    </main>
  );
}
