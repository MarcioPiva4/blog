import { timingSafeEqual } from "node:crypto";
import { publishDuePosts } from "@/lib/posts";
import { aggregateDay, purgeOldPageViews, todayISO } from "@/lib/stats";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("secret") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * Jobs (agendar no Coolify → Scheduled Tasks, ou crontab):
 *   publish    — a cada 10 min: publica posts agendados vencidos
 *   aggregate  — a cada hora: consolida page_views de hoje/ontem e limpa > 90 dias
 */
async function handle(req: Request, ctx: { params: Promise<{ job: string }> }) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const { job } = await ctx.params;

  switch (job) {
    case "publish": {
      const published = await publishDuePosts();
      return Response.json({ ok: true, published: published.length });
    }
    case "aggregate": {
      await aggregateDay(todayISO(-1));
      await aggregateDay(todayISO());
      await purgeOldPageViews(90);
      return Response.json({ ok: true });
    }
    default:
      return new Response("job desconhecido", { status: 404 });
  }
}

export { handle as GET, handle as POST };
