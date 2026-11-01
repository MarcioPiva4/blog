import { categorySitemapEntries, sitemapEntries, tagSitemapEntries } from "@/lib/public-data";
import { resolveTenant } from "@/lib/tenant";

// Consulta o banco: só no request, nunca no build (o banco ainda não tem tabelas durante o build)
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(_req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const res = await resolveTenant((await ctx.params).domain);
  if (res.kind !== "ok") return new Response("Not found", { status: 404 });
  const { blog, baseUrl } = res.tenant;
  // Só páginas indexáveis: categorias com posts e tags acima do mínimo (as demais são noindex)
  const [entries, cats, tagEntries] = await Promise.all([sitemapEntries(blog.id), categorySitemapEntries(blog.id), tagSitemapEntries(blog.id)]);
  const latest = entries[0]?.updatedAt ?? blog.updatedAt;

  const urls = [
    { loc: baseUrl + "/", lastmod: latest },
    ...cats.map((c) => ({ loc: `${baseUrl}/categoria/${c.slug}`, lastmod: c.updatedAt })),
    ...tagEntries.map((tg) => ({ loc: `${baseUrl}/tag/${tg.slug}`, lastmod: tg.updatedAt })),
    ...entries.map((p) => ({ loc: `${baseUrl}/${p.slug}`, lastmod: p.updatedAt })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${new Date(u.lastmod).toISOString()}</lastmod></url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
