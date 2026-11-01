import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostList } from "@/components/site/post-list";
import { t } from "@/lib/i18n";
import { getAuthorBySlug, listPosts } from "@/lib/public-data";
import { jsonLdString } from "@/lib/seo/jsonld";
import { loadTenant } from "@/lib/site";
import { resolveTenant } from "@/lib/tenant";

export const revalidate = 3600;
export const generateStaticParams = () => [];

type Params = { params: Promise<{ domain: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { domain, slug } = await params;
  const res = await resolveTenant(domain);
  if (res.kind !== "ok") return {};
  const author = await getAuthorBySlug(res.tenant.blog.id, slug);
  if (!author) return {};
  return { title: author.name, description: author.bio.slice(0, 160) || undefined, alternates: { canonical: `/autor/${author.slug}` } };
}

export default async function AuthorPage({ params }: Params) {
  const { domain, slug } = await params;
  const tenant = await loadTenant(domain, `/autor/${slug}`);
  const author = await getAuthorBySlug(tenant.blog.id, slug);
  if (!author) notFound();
  const d = t(tenant.blog.language);
  const { items } = await listPosts(tenant.blog.id, { authorId: author.id, limit: 30 });
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    description: author.bio,
    url: `${tenant.baseUrl}/autor/${author.slug}`,
    ...(author.avatarUrl ? { image: author.avatarUrl } : {}),
    ...(Object.keys(author.links).length ? { sameAs: Object.values(author.links) } : {}),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(person) }} />
      <header className="mx-auto mb-10 flex max-w-2xl flex-col items-center text-center">
        {author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.avatarUrl} alt={author.name} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-2xl font-bold text-brand-foreground">{author.name.slice(0, 1)}</span>
        )}
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{author.name}</h1>
        {author.expertise && <p className="mt-1 text-sm font-medium text-brand">{author.expertise}</p>}
        {author.bio && <p className="mt-3 text-zinc-600">{author.bio}</p>}
      </header>
      {items.length ? <PostList theme="minimal" posts={items} categories={tenant.categories} d={d} locale={tenant.blog.language} /> : <p className="text-center text-zinc-500">{d.noPosts}</p>}
    </main>
  );
}
