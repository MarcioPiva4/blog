import type { Author, Blog, Category, FaqItem, Post } from "@/db/schema";

type PostLike = Pick<Post, "title" | "slug" | "excerpt" | "metaDescription" | "coverImage" | "publishedAt" | "updatedAt" | "wordCount"> & {
  faq: FaqItem[];
};

export function websiteJsonLd(blog: Blog, baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: blog.name,
    description: blog.description,
    url: baseUrl,
    inLanguage: blog.language,
    publisher: organization(blog, baseUrl),
  };
}

function organization(blog: Blog, baseUrl: string) {
  return {
    "@type": "Organization",
    name: blog.name,
    url: baseUrl,
    ...(blog.logoUrl ? { logo: { "@type": "ImageObject", url: absolute(blog.logoUrl, baseUrl) } } : {}),
  };
}

export function absolute(url: string, baseUrl: string) {
  return /^https?:\/\//.test(url) ? url : `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function articleJsonLd(opts: { blog: Blog; baseUrl: string; post: PostLike; author: Author | null; category: Category | null; keywords?: string[] }) {
  const { blog, baseUrl, post, author, category } = opts;
  const keywords = [...new Set((opts.keywords ?? []).filter(Boolean))];
  const url = `${baseUrl}/${post.slug}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: post.title,
      description: post.metaDescription || post.excerpt,
      url,
      mainEntityOfPage: url,
      inLanguage: blog.language,
      datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      dateModified: new Date(post.updatedAt).toISOString(),
      wordCount: post.wordCount,
      ...(post.coverImage ? { image: [absolute(post.coverImage, baseUrl)] } : {}),
      ...(category ? { articleSection: category.name } : {}),
      ...(keywords.length ? { keywords: keywords.join(", ") } : {}),
      author: author
        ? { "@type": "Person", name: author.name, url: `${baseUrl}/autor/${author.slug}` }
        : { "@type": "Organization", name: blog.name, url: baseUrl },
      publisher: organization(blog, baseUrl),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: blog.name, item: baseUrl },
        ...(category ? [{ "@type": "ListItem", position: 2, name: category.name, item: `${baseUrl}/categoria/${category.slug}` }] : []),
        { "@type": "ListItem", position: category ? 3 : 2, name: post.title, item: url },
      ],
    },
  ];
  if (post.faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: post.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** Página de categoria/tag: CollectionPage com a lista de posts + breadcrumb. */
export function collectionJsonLd(opts: { blog: Blog; baseUrl: string; name: string; path: string; description: string; posts: { title: string; slug: string }[] }) {
  const { blog, baseUrl, name, path, description, posts } = opts;
  const url = `${baseUrl}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name,
        description,
        url,
        inLanguage: blog.language,
        isPartOf: { "@type": "WebSite", name: blog.name, url: baseUrl },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: posts.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${baseUrl}/${p.slug}`, name: p.title })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: blog.name, item: baseUrl },
          { "@type": "ListItem", position: 2, name, item: url },
        ],
      },
    ],
  };
}

/** Serializa para <script type="application/ld+json"> evitando quebra de tag. */
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
