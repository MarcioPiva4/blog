import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostList } from "@/components/site/post-list";
import { t } from "@/lib/i18n";
import { getCategoryBySlug, listTaxonomyPosts } from "@/lib/public-data";
import { collectionJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { loadTenant } from "@/lib/site";
import { resolveTenant } from "@/lib/tenant";

export const revalidate = 3600;
export const generateStaticParams = () => [];

type Params = { params: Promise<{ domain: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { domain, slug } = await params;
  const res = await resolveTenant(domain);
  if (res.kind !== "ok") return {};
  const { blog } = res.tenant;
  const cat = await getCategoryBySlug(blog.id, slug);
  if (!cat) return {};
  const { total } = await listTaxonomyPosts(blog.id, "category", cat.id);
  const description = cat.description || `${t(blog.language).articlesAbout} ${cat.name} — ${blog.name}.`;
  const path = `/categoria/${cat.slug}`;
  return {
    title: cat.name,
    description,
    alternates: { canonical: path },
    // Categoria sem posts publicados é página rasa: fora do índice até ter conteúdo.
    // Sem a chave, herda o robots do layout (max-image-preview); `undefined` apagaria.
    ...(total === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", siteName: blog.name, locale: blog.language.replace("-", "_"), title: cat.name, description, url: path },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { domain, slug } = await params;
  const tenant = await loadTenant(domain, `/categoria/${slug}`);
  const { blog, baseUrl } = tenant;
  const cat = await getCategoryBySlug(blog.id, slug);
  if (!cat) notFound();
  const d = t(blog.language);
  const { items } = await listTaxonomyPosts(blog.id, "category", cat.id);
  const jsonLd = collectionJsonLd({
    blog,
    baseUrl,
    name: cat.name,
    path: `/categoria/${cat.slug}`,
    description: cat.description || `${d.articlesAbout} ${cat.name}`,
    posts: items,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">{d.categories}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{cat.name}</h1>
        {cat.description && <p className="mt-3 text-zinc-600">{cat.description}</p>}
      </header>
      {items.length ? (
        <PostList theme={blog.theme === "magazine" ? "magazine" : "minimal"} posts={items} categories={tenant.categories} d={d} locale={blog.language} />
      ) : (
        <p className="py-16 text-center text-zinc-500">{d.noPosts}</p>
      )}
    </main>
  );
}
