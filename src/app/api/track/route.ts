import { createHash } from "node:crypto";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { todayISO } from "@/lib/stats";

export const dynamic = "force-dynamic";

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor|curl|wget|python|axios/i;

/** Beacon de pageview: sem cookies, sem IP salvo (hash diário anônimo). */
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_RE.test(ua)) return new Response(null, { status: 204 });

  let body: { b?: number; p?: number | null; path?: string; r?: string };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const blogId = Number(body.b);
  if (!Number.isInteger(blogId) || blogId <= 0) return new Response(null, { status: 400 });

  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  let referrerHost: string | null = null;
  try {
    referrerHost = body.r ? new URL(body.r).hostname.replace(/^www\./, "") : null;
    if (referrerHost === host) referrerHost = null; // navegação interna
  } catch {}

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const sessionHash = createHash("sha256").update(`${todayISO()}|${process.env.AUTH_SECRET}|${ip}|${ua}|${blogId}`).digest("hex").slice(0, 24);
  const device = /tablet|ipad/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";

  await db.insert(pageViews).values({
    blogId,
    postId: Number.isInteger(body.p) && body.p! > 0 ? body.p! : null,
    path: String(body.path ?? "/").slice(0, 300),
    referrerHost,
    country: req.headers.get("cf-ipcountry"),
    device,
    sessionHash,
  });
  return new Response(null, { status: 204 });
}
