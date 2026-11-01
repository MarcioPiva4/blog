import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostList } from "@/components/site/post-list";
import { TAG_INDEX_MIN_POSTS } from "@/lib/config";
import { t } from "@/lib/i18n";
import { getTagBySlug, listTaxonomyPosts } from "@/lib/public-data";
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
  const tag = await getTagBySlug(blog.id, slug);
  if (!tag) return {};
  const { total } = await listTaxonomyPosts(blog.id, "tag", tag.id);
  const title = `${t(blog.language).articlesAbout} ${tag.name}`;
  const description = `${title} — ${blog.name}.`;
  const path = `/tag/${tag.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    // Poucas publicações = página rasa; o Google segue os links mas não indexa
    ...(total < TAG_INDEX_MIN_POSTS ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", siteName: blog.name, locale: blog.language.replace("-", "_"), title, description, url: path },
  };
}

export default async function TagPage({ params }: Params) {
  const { domain, slug } = await params;
  const tenant = await loadTenant(domain, `/tag/${slug}`);
  const { blog, baseUrl } = tenant;
  const tag = await getTagBySlug(blog.id, slug);
  if (!tag) notFound();
  const d = t(blog.language);
  const { items } = await listTaxonomyPosts(blog.id, "tag", tag.id);
  const jsonLd = collectionJsonLd({ blog, baseUrl, name: tag.name, path: `/tag/${tag.slug}`, description: `${d.articlesAbout} ${tag.name}`, posts: items });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">{d.tag}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">#{tag.name}</h1>
      </header>
      {items.length ? (
        <PostList theme={blog.theme === "magazine" ? "magazine" : "minimal"} posts={items} categories={tenant.categories} d={d} locale={blog.language} />
      ) : (
        <p className="py-16 text-center text-zinc-500">{d.noPosts}</p>
      )}
    </main>
  );
}
