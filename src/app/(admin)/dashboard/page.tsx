import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/db";
import { blogs, posts, topicQueue } from "@/db/schema";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, buttonClass } from "@/components/ui";
import { ViewsChart } from "@/components/admin/views-chart";
import { blogBaseUrl } from "@/lib/tenant";
import { viewsByDay, viewsPerBlog } from "@/lib/stats";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata = { title: "Visão geral" };

export default async function OverviewPage() {
  const [blogList, counts, topicsPending, series, perBlog, upcoming] = await Promise.all([
    db.query.blogs.findMany({ where: eq(blogs.archived, false), orderBy: asc(blogs.id) }),
    db
      .select({
        blogId: posts.blogId,
        status: posts.status,
        n: sql<number>`count(*)::int`,
        last: sql<Date | null>`max(${posts.publishedAt})`,
      })
      .from(posts)
      .groupBy(posts.blogId, posts.status),
    db.$count(topicQueue, eq(topicQueue.status, "idea")),
    viewsByDay(30),
    viewsPerBlog(30),
    db.query.posts.findMany({
      where: eq(posts.status, "scheduled"),
      orderBy: asc(posts.publishAt),
      limit: 6,
      with: { blog: { columns: { name: true, brandColor: true } } },
    }),
  ]);

  const total = (status: string) => counts.filter((c) => c.status === status).reduce((s, c) => s + c.n, 0);
  const views30 = series.reduce((s, d) => s + d.views, 0);
  const urls = await Promise.all(blogList.map((b) => blogBaseUrl(b)));

  const kpis = [
    { label: "Visualizações (30 dias)", value: formatNumber(views30) },
    { label: "Posts publicados", value: formatNumber(total("published")) },
    { label: "Agendados", value: formatNumber(total("scheduled")) },
    { label: "Aguardando revisão", value: formatNumber(total("review")), href: "/dashboard/posts?status=review" },
    { label: "Pautas na fila", value: formatNumber(topicsPending), href: "/dashboard/pauta" },
  ];

  return (
    <>
      <PageHeader title="Visão geral" description="Desempenho da rede inteira." action={<Link href="/dashboard/posts/new" className={buttonClass()}>Novo post</Link>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((k) => {
          const inner = (
            <Card className="h-full p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
            </Card>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="hover:opacity-80">
              {inner}
            </Link>
          ) : (
            <div key={k.label}>{inner}</div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Visualizações por dia" description="Últimos 30 dias, todos os blogs" />
          <div className="p-4">
            <ViewsChart data={series} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Próximas publicações" />
          {upcoming.length ? (
            <ul className="divide-y">
              {upcoming.map((p) => (
                <li key={p.id} className="px-5 py-3">
                  <Link href={`/dashboard/posts/${p.id}`} className="line-clamp-2 text-sm font-medium hover:underline">
                    {p.title}
                  </Link>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.blog.brandColor }} />
                    {p.blog.name} · {formatDateTime(p.publishAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nada agendado.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Blogs" action={<Link href="/dashboard/blogs/new" className={buttonClass("outline", "sm")}>Novo blog</Link>} />
        {blogList.length ? (
          <Table>
            <thead>
              <tr>
                <th>Blog</th>
                <th>Idioma</th>
                <th className="text-right">Publicados</th>
                <th className="text-right">Agendados</th>
                <th className="text-right">Views 30d</th>
                <th>Último post</th>
              </tr>
            </thead>
            <tbody>
              {blogList.map((b, i) => {
                const c = (s: string) => counts.find((x) => x.blogId === b.id && x.status === s);
                return (
                  <tr key={b.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.brandColor }} />
                        <Link href={`/dashboard/blogs/${b.id}`} className="font-medium hover:underline">
                          {b.name}
                        </Link>
                        <a href={urls[i]} target="_blank" className="text-muted-foreground hover:text-foreground" aria-label="Abrir blog">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">{b.niche}</p>
                    </td>
                    <td>
                      <Badge>{b.language}</Badge>
                    </td>
                    <td className="text-right tabular-nums">{c("published")?.n ?? 0}</td>
                    <td className="text-right tabular-nums">{c("scheduled")?.n ?? 0}</td>
                    <td className="text-right tabular-nums">{formatNumber(perBlog.find((v) => v.blog_id === b.id)?.views ?? 0)}</td>
                    <td className="text-muted-foreground">{formatDate(c("published")?.last)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState title="Nenhum blog ainda">
              Rode <code>npm run db:seed</code> para criar os 5 blogs iniciais ou <Link href="/dashboard/blogs/new" className="underline">crie um blog</Link>.
            </EmptyState>
          </div>
        )}
      </Card>
    </>
  );
}
