import type { Metadata } from "next";
import Script from "next/script";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { Tracker } from "@/components/site/tracker";
import { readableOn } from "@/lib/color";
import { fontVars } from "@/lib/fonts";
import { resolveTenant } from "@/lib/tenant";
import { websiteJsonLd, jsonLdString } from "@/lib/seo/jsonld";
import "../../globals.css";

export const revalidate = 3600;

export function generateStaticParams() {
  // Gera cada blog sob demanda na primeira visita e mantém em cache (ISR)
  return [];
}

type Params = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const res = await resolveTenant((await params).domain);
  if (res.kind !== "ok") return { title: "Blog" };
  const { blog, baseUrl } = res.tenant;
  return {
    metadataBase: new URL(baseUrl),
    title: { default: blog.tagline ? `${blog.name} — ${blog.tagline}` : blog.name, template: `%s | ${blog.name}` },
    description: blog.description || blog.tagline,
    applicationName: blog.name,
    alternates: { canonical: "/", types: { "application/rss+xml": [{ url: "/feed.xml", title: blog.name }] } },
    openGraph: { type: "website", siteName: blog.name, locale: blog.language.replace("-", "_"), url: "/" },
    twitter: { card: "summary_large_image" },
    icons: blog.faviconUrl ? { icon: blog.faviconUrl } : undefined,
    robots: { index: true, follow: true, "max-image-preview": "large" },
  };
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode } & Params) {
  const res = await resolveTenant((await params).domain);

  if (res.kind !== "ok") {
    // As páginas fazem o 301 (mantendo o caminho) ou o 404 via loadTenant()
    return (
      <html lang="pt-BR" className={fontVars}>
        <body className="font-sans text-zinc-600">{children}</body>
      </html>
    );
  }

  const { tenant } = res;
  const { blog } = tenant;
  const style = { "--brand": blog.brandColor, "--brand-foreground": readableOn(blog.brandColor) } as React.CSSProperties;

  return (
    <html lang={blog.language} className={fontVars} style={style}>
      <body className={`theme-${blog.theme} flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd(blog, tenant.baseUrl)) }} />
        <SiteHeader tenant={tenant} />
        <div className="flex-1">{children}</div>
        <SiteFooter tenant={tenant} />
        <Tracker blogId={blog.id} />
        {blog.adsEnabled && blog.adsensePubId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${blog.adsensePubId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
