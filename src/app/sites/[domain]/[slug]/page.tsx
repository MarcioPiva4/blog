import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/site/ad-slot";
import { t } from "@/lib/i18n";
import { institutionalKeyFor, institutionalPage } from "@/lib/institutional";
import { renderMarkdown, splitForAds } from "@/lib/markdown";
import { getPublicPost, relatedPosts } from "@/lib/public-data";
import { articleJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import { loadTenant } from "@/lib/site";
import { resolveTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;
export const generateStaticParams = () => [];

type Params = { params: Promise<{ domain: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { domain, slug } = await params;
  const res = await resolveTenant(domain);
  if (res.kind !== "ok") return {};
  const { blog } = res.tenant;

  const key = institutionalKeyFor(blog.language, slug);
  if (key) {
    const page = institutionalPage(blog, key, res.tenant.baseUrl);
    return { title: page.title, alternates: { canonical: `/${slug}` } };
  }

  const post = await getPublicPost(blog.id, slug);
  if (!post) return {};
  const title = post.seoTitle || post.title;
  const description = post.metaDescription || post.excerpt;
  return {
    title: { absolute: title.length <= 45 ? `${title} | ${blog.name}` : title },
    description,
    keywords: [post.focusKeyword, ...post.secondaryKeywords].filter(Boolean) as string[],
    alternates: { canonical: post.canonicalUrl || `/${post.slug}` },
    // Sem a chave, herda o robots do layout (max-image-preview:large); `undefined` apagaria
    ...(post.noindex ? { robots: { index: false, follow: true } } : {}),
    authors: post.author ? [{ name: post.author.name, url: `/autor/${post.author.slug}` }] : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url: `/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      section: post.category?.name,
      tags: post.postTags.map((pt) => pt.tag.name),
      images: post.coverImage ? [{ url: post.coverImage, alt: post.coverAlt ?? title }] : [{ url: `/og/${post.slug}`, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function PostPage({ params }: Params) {
  const { domain, slug } = await params;
  const tenant = await loadTenant(domain, `/${slug}`);
  const { blog, baseUrl } = tenant;
  const d = t(blog.language);

  // Páginas institucionais (Sobre, Contato, Privacidade, Termos)
  const key = institutionalKeyFor(blog.language, slug);
  if (key) {
    const page = institutionalPage(blog, key, baseUrl);
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{page.title}</h1>
        <div className="prose-article mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(page.md).html }} />
      </main>
    );
  }

  const post = await getPublicPost(blog.id, slug);
  if (!post) notFound();

  const { html, toc } = renderMarkdown(post.contentMd);
  const showAds = blog.adsEnabled && !!blog.adsensePubId;
  const chunks = showAds ? splitForAds(html, blog.inContentAdAfter) : [html];
  const related = await relatedPosts(blog.id, post.id, post.categoryId, 4);
  const updated = post.publishedAt && post.updatedAt.getTime() - post.publishedAt.getTime() > 86400_000;
  const jsonLd = articleJsonLd({
    blog,
    baseUrl,
    post,
    author: post.author,
    category: post.category,
    keywords: [post.focusKeyword ?? "", ...post.postTags.map((pt) => pt.tag.name)],
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <article data-post-id={post.id} className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
        <div className="mx-auto w-full max-w-[720px]">
          <nav className="mb-4 text-sm text-zinc-500" aria-label="breadcrumb">
            <Link href="/" className="hover:text-zinc-900">{d.home}</Link>
            {post.category && (
              <>
                {" / "}
                <Link href={`/categoria/${post.category.slug}`} className="hover:text-zinc-900">{post.category.name}</Link>
              </>
            )}
          </nav>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-zinc-900 md:text-[2.6rem]">{post.title}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
            {post.author && (
              <span>
                {d.by}{" "}
                <Link href={`/autor/${post.author.slug}`} className="font-medium text-zinc-800 hover:underline">{post.author.name}</Link>
              </span>
            )}
            <span>·</span>
            <time dateTime={post.publishedAt?.toISOString()}>
              {d.published} {formatDate(post.publishedAt, blog.language)}
            </time>
            {updated && (
              <>
                <span>·</span>
                <time dateTime={post.updatedAt.toISOString()}>
                  {d.updated} {formatDate(post.updatedAt, blog.language)}
                </time>
              </>
            )}
            <span>·</span>
            <span>{post.readingTime} {d.minRead}</span>
          </div>

          {post.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImage} alt={post.coverAlt ?? post.title} className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover" fetchPriority="high" />
          )}

          {post.affiliateProducts.length > 0 && blog.affiliateDisclosure && (
            <p className="mt-6 rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-500">{blog.affiliateDisclosure}</p>
          )}

          {toc.length >= 3 && (
            <details className="mt-8 rounded-xl border border-zinc-200 p-4 lg:hidden" open>
              <summary className="cursor-pointer text-sm font-semibold">{d.toc}</summary>
              <TocList toc={toc} />
            </details>
          )}

          <div className="mt-8">
            {chunks.map((chunk, i) => (
              <div key={i}>
                <div className="prose-article" dangerouslySetInnerHTML={{ __html: chunk }} />
                {showAds && i < chunks.length - 1 && <AdSlot pubId={blog.adsensePubId!} label={d.ad} />}
              </div>
            ))}
          </div>

          {post.affiliateProducts.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold">{d.recommended}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {post.affiliateProducts.map((p) => (
                  <a key={p.url} href={p.url} target="_blank" rel="sponsored nofollow noopener" className="flex gap-4 rounded-xl border border-zinc-200 p-4 hover:border-brand">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.name} className="h-20 w-20 shrink-0 rounded-lg object-contain" loading="lazy" />
                    )}
                    <div>
                      <p className="font-semibold leading-snug">{p.name}</p>
                      {p.price && <p className="mt-1 text-sm text-zinc-600">{p.price}</p>}
                      <span className="mt-2 inline-block rounded-md bg-brand px-3 py-1 text-xs font-medium text-brand-foreground">→</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {post.faq.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">{d.faq}</h2>
              <div className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
                {post.faq.map((f, i) => (
                  <details key={i} className="group p-5" open={i === 0}>
                    <summary className="cursor-pointer list-none font-semibold">
                      <span className="mr-2 text-brand group-open:rotate-90">›</span>
                      {f.question}
                    </summary>
                    <p className="mt-3 leading-relaxed text-zinc-700">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {showAds && <AdSlot pubId={blog.adsensePubId!} label={d.ad} />}

          {post.sources.length > 0 && (
            <section className="mt-10 text-sm">
              <h2 className="font-semibold text-zinc-900">{d.sources}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                {post.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-zinc-900">{s.title}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {post.postTags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.postTags.map((pt) => (
                <Link key={pt.tag.id} href={`/tag/${pt.tag.slug}`} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900">
                  #{pt.tag.name}
                </Link>
              ))}
            </div>
          )}

          {post.author && (
            <aside className="mt-10 flex gap-4 rounded-xl bg-zinc-50 p-5">
              {post.author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.author.avatarUrl} alt={post.author.name} className="h-14 w-14 rounded-full object-cover" loading="lazy" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-brand-foreground">{post.author.name.slice(0, 1)}</span>
              )}
              <div>
                <Link href={`/autor/${post.author.slug}`} className="font-semibold hover:underline">{post.author.name}</Link>
                {post.author.bio && <p className="mt-1 text-sm text-zinc-600">{post.author.bio}</p>}
              </div>
            </aside>
          )}
        </div>

        {toc.length >= 3 && (
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-xl border border-zinc-200 p-4">
              <p className="text-sm font-semibold">{d.toc}</p>
              <TocList toc={toc} />
            </div>
          </aside>
        )}
      </article>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl border-t border-zinc-200 pt-10">
          <h2 className="text-xl font-bold">{d.related}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <Link key={p.id} href={`/${p.slug}`} className="group">
                {p.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImage} alt={p.coverAlt ?? ""} loading="lazy" className="aspect-[16/10] w-full rounded-lg object-cover" />
                ) : (
                  <div className="aspect-[16/10] w-full rounded-lg bg-gradient-to-br from-brand/70 to-brand" />
                )}
                <p className="mt-3 font-semibold leading-snug group-hover:text-brand">{p.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function TocList({ toc }: { toc: { id: string; text: string; level: 2 | 3 }[] }) {
  return (
    <ol className="mt-3 space-y-1.5 text-sm">
      {toc.map((h) => (
        <li key={h.id} className={h.level === 3 ? "pl-4" : ""}>
          <a href={`#${h.id}`} className="text-zinc-600 hover:text-brand">{h.text}</a>
        </li>
      ))}
    </ol>
  );
}
