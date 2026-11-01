import { resolveTenant } from "@/lib/tenant";

// Consulta o banco: só no request, nunca no build
export const dynamic = "force-dynamic";

/** ads.txt por domínio, gerado a partir do Publisher ID do AdSense do blog. */
export async function GET(_req: Request, ctx: { params: Promise<{ domain: string }> }) {
  const res = await resolveTenant((await ctx.params).domain);
  const pub = res.kind === "ok" ? res.tenant.blog.adsensePubId : null;
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
