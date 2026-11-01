import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Fuso usado para "dias" nas estatísticas. */
export const STATS_TZ = "America/Sao_Paulo";

type Row = Record<string, unknown>;
const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];

/** Consolida page_views de um dia (YYYY-MM-DD) em daily_stats. Idempotente. */
export async function aggregateDay(day: string) {
  await db.execute(sql`
    insert into daily_stats (blog_id, post_id, date, views, uniques)
    select blog_id, post_id, ${day}::date, count(*), count(distinct session_hash)
    from page_views
    where post_id is not null and (created_at at time zone ${STATS_TZ})::date = ${day}::date
    group by blog_id, post_id
    on conflict (blog_id, post_id, date) do update set views = excluded.views, uniques = excluded.uniques`);
  await db.execute(sql`
    insert into daily_stats (blog_id, post_id, date, views, uniques, top_referrers)
    select v.blog_id, 0, ${day}::date, count(*), count(distinct v.session_hash),
      coalesce((select jsonb_object_agg(r.referrer_host, r.c) from (
        select referrer_host, count(*) c from page_views p
        where p.blog_id = v.blog_id and p.referrer_host is not null and (p.created_at at time zone ${STATS_TZ})::date = ${day}::date
        group by referrer_host order by c desc limit 10) r), '{}'::jsonb)
    from page_views v
    where (v.created_at at time zone ${STATS_TZ})::date = ${day}::date
    group by v.blog_id
    on conflict (blog_id, post_id, date) do update
      set views = excluded.views, uniques = excluded.uniques, top_referrers = excluded.top_referrers`);
}

export async function purgeOldPageViews(days = 90) {
  await db.execute(sql`delete from page_views where created_at < now() - make_interval(days => ${days})`);
}

export function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: STATS_TZ }).format(d); // YYYY-MM-DD
}

/** Visualizações por dia: daily_stats para dias passados + page_views ao vivo para hoje. */
export async function viewsByDay(days: number, blogId?: number) {
  const since = todayISO(-(days - 1));
  const today = todayISO();
  const blogFilter = blogId ? sql`and blog_id = ${blogId}` : sql``;
  const past = await rows<{ date: string; views: number; uniques: number }>(sql`
    select to_char(date, 'YYYY-MM-DD') as date, sum(views)::int as views, sum(uniques)::int as uniques
    from daily_stats where post_id = 0 and date >= ${since}::date and date < ${today}::date ${blogFilter}
    group by date order by date`);
  const [live] = await rows<{ views: number; uniques: number }>(sql`
    select count(*)::int as views, count(distinct session_hash)::int as uniques
    from page_views where (created_at at time zone ${STATS_TZ})::date = ${today}::date ${blogFilter}`);

  const map = new Map(past.map((r) => [r.date, r]));
  const out: { date: string; views: number; uniques: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = todayISO(-i);
    out.push(d === today ? { date: d, views: live?.views ?? 0, uniques: live?.uniques ?? 0 } : (map.get(d) ?? { date: d, views: 0, uniques: 0 }));
  }
  return out;
}

export async function viewsPerBlog(days: number) {
  const since = todayISO(-(days - 1));
  return rows<{ blog_id: number; views: number }>(sql`
    select blog_id, sum(views)::int as views from (
      select blog_id, views from daily_stats where post_id = 0 and date >= ${since}::date and date < ${todayISO()}::date
      union all
      select blog_id, 1 from page_views where (created_at at time zone ${STATS_TZ})::date = ${todayISO()}::date
    ) t group by blog_id`);
}

export async function topPosts(days: number, blogId?: number, limit = 10) {
  const since = todayISO(-(days - 1));
  const blogFilter = blogId ? sql`and d.blog_id = ${blogId}` : sql``;
  return rows<{ post_id: number; blog_id: number; title: string; slug: string; views: number } & Row>(sql`
    select d.post_id, d.blog_id, p.title, p.slug, sum(d.views)::int as views
    from daily_stats d join posts p on p.id = d.post_id
    where d.post_id > 0 and d.date >= ${since}::date ${blogFilter}
    group by d.post_id, d.blog_id, p.title, p.slug
    order by views desc limit ${limit}`);
}
