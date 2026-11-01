import { listPosts } from "@/lib/public-data";
import { resolveTenant } from "@/lib/tenant";

export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(_req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const res = await resolveTenant((await ctx.params).domain);
  if (res.kind !== "ok") return new Response("Not found", { status: 404 });
  const { blog, baseUrl } = res.tenant;
  const { items } = await listPosts(blog.id, { limit: 30 });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(blog.name)}</title>
  <link>${baseUrl}/</link>
  <description>${esc(blog.description || blog.tagline)}</description>
  <language>${blog.language}</language>
  <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${baseUrl}/${p.slug}</link>
    <guid isPermaLink="true">${baseUrl}/${p.slug}</guid>
    <pubDate>${p.publishedAt ? new Date(p.publishedAt).toUTCString() : ""}</pubDate>
    <description>${esc(p.excerpt)}</description>
  </item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
