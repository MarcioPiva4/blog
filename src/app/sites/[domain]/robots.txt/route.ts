import { resolveTenant } from "@/lib/tenant";

// Consulta o banco: só no request, nunca no build
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const res = await resolveTenant((await ctx.params).domain);
  if (res.kind !== "ok") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
  const body = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${res.tenant.baseUrl}/sitemap.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
