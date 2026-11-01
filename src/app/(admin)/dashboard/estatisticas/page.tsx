import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs } from "@/db/schema";
import { Button, Card, CardHeader, EmptyState, PageHeader, Select, Table } from "@/components/ui";
import { ViewsChart } from "@/components/admin/views-chart";
import { STATS_TZ, todayISO, topPosts, viewsByDay } from "@/lib/stats";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Estatísticas" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ blog?: string; days?: string }> }) {
  const sp = await searchParams;
  const blogId = sp.blog ? Number(sp.blog) : undefined;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = todayISO(-(days - 1));
  const blogFilter = blogId ? sql`and blog_id = ${blogId}` : sql``;

  const [blogList, series, top, referrers, devices] = await Promise.all([
    db.select({ id: blogs.id, name: blogs.name }).from(blogs).orderBy(asc(blogs.id)),
    viewsByDay(days, blogId),
    topPosts(days, blogId, 15),
    db.execute(sql`
      select coalesce(referrer_host, '(direto)') as host, count(*)::int as views from page_views
      where (created_at at time zone ${STATS_TZ})::date >= ${since}::date ${blogFilter}
      group by 1 order by 2 desc limit 10`) as unknown as Promise<{ host: string; views: number }[]>,
    db.execute(sql`
      select coalesce(device, '?') as device, count(*)::int as views from page_views
      where (created_at at time zone ${STATS_TZ})::date >= ${since}::date ${blogFilter}
      group by 1 order by 2 desc`) as unknown as Promise<{ device: string; views: number }[]>,
  ]);

  const total = series.reduce((s, d) => s + d.views, 0);
  const uniques = series.reduce((s, d) => s + d.uniques, 0);
  const deviceTotal = devices.reduce((s, d) => s + d.views, 0) || 1;
  const DEVICE: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tablet" };

  return (
    <>
      <PageHeader title="Estatísticas" description="Tráfego próprio (sem cookies). Search Console e receita entram nas próximas fases." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="blog" defaultValue={sp.blog ?? ""} className="w-auto">
          <option value="">Rede inteira</option>
          {blogList.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select name="days" defaultValue={String(days)} className="w-auto">
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
        </Select>
        <Button variant="outline">Aplicar</Button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Visualizações</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Visitantes únicos (soma diária)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(uniques)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Média por dia</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(Math.round(total / days))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Celular</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{Math.round(((devices.find((d) => d.device === "mobile")?.views ?? 0) / deviceTotal) * 100)}%</p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Visualizações por dia" />
        <div className="p-4">
          <ViewsChart data={series} />
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Posts mais lidos" description="Consolidado até ontem" />
          {top.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th className="text-right">Views</th>
                </tr>
              </thead>
              <tbody>
                {top.map((p) => (
                  <tr key={p.post_id}>
                    <td>
                      <Link href={`/dashboard/posts/${p.post_id}`} className="hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{formatNumber(p.views)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState title="Sem dados ainda" />
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Origem do tráfego" />
          <Table>
            <thead>
              <tr>
                <th>Origem</th>
                <th className="text-right">Views</th>
              </tr>
            </thead>
            <tbody>
              {referrers.map((r) => (
                <tr key={r.host}>
                  <td className="truncate">{r.host}</td>
                  <td className="text-right tabular-nums">{formatNumber(r.views)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="border-t px-5 py-3 text-xs text-muted-foreground">
            {devices.map((d) => `${DEVICE[d.device] ?? d.device}: ${Math.round((d.views / deviceTotal) * 100)}%`).join(" · ") || "Sem dados"}
          </div>
        </Card>
      </div>
    </>
  );
}
