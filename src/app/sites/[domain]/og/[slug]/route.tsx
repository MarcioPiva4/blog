import { ImageResponse } from "next/og";
import { getPublicPost } from "@/lib/public-data";
import { resolveTenant } from "@/lib/tenant";
import { readableOn } from "@/lib/color";

// Consulta o banco: só no request, nunca no build
export const dynamic = "force-dynamic";

/** Imagem OG automática (/og/<slug>): título do post + marca do blog. Usada quando o post não tem capa. */
export async function GET(_req: Request, ctx: { params: Promise<{ domain: string; slug: string }> }) {
  const { domain, slug } = await ctx.params;
  const res = await resolveTenant(domain);
  if (res.kind !== "ok") return new Response(null, { status: 404 });
  const { blog, baseUrl } = res.tenant;
  const post = await getPublicPost(blog.id, slug);
  const fg = readableOn(blog.brandColor);
  const title = post?.title ?? blog.name;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: blog.brandColor, color: fg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: fg, color: blog.brandColor, display: "flex", alignItems: "center", justifyContent: "center" }}>{blog.name.slice(0, 1)}</div>
          {blog.name}
        </div>
        <div style={{ fontSize: title.length > 70 ? 56 : 68, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5, display: "flex" }}>{title}</div>
        <div style={{ fontSize: 26, opacity: 0.8, display: "flex" }}>{baseUrl.replace(/^https?:\/\//, "")}</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
