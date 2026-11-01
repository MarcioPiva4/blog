import Link from "next/link";
import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { Bot } from "lucide-react";
import { db } from "@/db";
import { blogs, posts } from "@/db/schema";
import { Button, Card, EmptyState, Input, PageHeader, ScoreBadge, Select, StatusBadge, Table, buttonClass } from "@/components/ui";
import { POST_STATUSES } from "@/lib/posts";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Posts" };

const PAGE_SIZE = 30;

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ blog?: string; status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filters: SQL[] = [];
  if (sp.blog) filters.push(eq(posts.blogId, Number(sp.blog)));
  if (sp.status && (POST_STATUSES as readonly string[]).includes(sp.status)) filters.push(eq(posts.status, sp.status as (typeof POST_STATUSES)[number]));
  if (sp.q) filters.push(ilike(posts.title, `%${sp.q}%`));
  const where = filters.length ? and(...filters) : undefined;

  const [blogList, rows, total] = await Promise.all([
    db.select({ id: blogs.id, name: blogs.name }).from(blogs).orderBy(asc(blogs.id)),
    db.query.posts.findMany({
      where,
      orderBy: [sql`case when ${posts.status} = 'scheduled' then 0 when ${posts.status} = 'review' then 1 else 2 end`, desc(posts.updatedAt)],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      columns: { contentMd: false },
      with: { blog: { columns: { name: true, brandColor: true } } },
    }),
    db.$count(posts, where),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => new URLSearchParams({ ...(sp.blog && { blog: sp.blog }), ...(sp.status && { status: sp.status }), ...(sp.q && { q: sp.q }), page: String(p) }).toString();

  return (
    <>
      <PageHeader title="Posts" description={`${total} posts`} action={<Link href="/dashboard/posts/new" className={buttonClass()}>Novo post</Link>} />

      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="blog" defaultValue={sp.blog ?? ""} className="w-auto">
          <option value="">Todos os blogs</option>
          {blogList.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-auto">
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="review">Revisão</option>
          <option value="scheduled">Agendado</option>
          <option value="published">Publicado</option>
          <option value="archived">Arquivado</option>
        </Select>
        <Input name="q" defaultValue={sp.q} placeholder="Buscar título…" className="w-56" />
        <Button variant="outline">Filtrar</Button>
      </form>

      <Card>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Blog</th>
                <th>Status</th>
                <th>SEO</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="max-w-md">
                    <Link href={`/dashboard/posts/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {p.source === "mcp" && <Bot className="h-3 w-3" aria-label="Escrito pela IA" />}
                      {p.focusKeyword ?? "sem palavra-chave"} · {p.wordCount} palavras
                    </p>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.blog.brandColor }} />
                      {p.blog.name}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    <ScoreBadge score={p.seoScore} />
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(p.status === "scheduled" ? p.publishAt : p.status === "published" ? p.publishedAt : p.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState title="Nenhum post encontrado" />
          </div>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          {page > 1 && <Link href={`?${qs(page - 1)}`} className={buttonClass("outline", "sm")}>Anterior</Link>}
          <span className="text-muted-foreground">
            {page} / {pages}
          </span>
          {page < pages && <Link href={`?${qs(page + 1)}`} className={buttonClass("outline", "sm")}>Próxima</Link>}
        </div>
      )}
    </>
  );
}
