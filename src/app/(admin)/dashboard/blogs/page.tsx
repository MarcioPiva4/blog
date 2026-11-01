import Link from "next/link";
import { asc } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/db";
import { blogs } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { blogBaseUrl } from "@/lib/tenant";

export const metadata = { title: "Blogs" };

const THEME = { minimal: "Minimal", magazine: "Magazine", editorial: "Editorial" } as const;

export default async function BlogsPage() {
  const list = await db.query.blogs.findMany({ orderBy: asc(blogs.id) });
  const urls = await Promise.all(list.map((b) => blogBaseUrl(b)));

  return (
    <>
      <PageHeader title="Blogs" description="Cada blog tem domínio, tema e guia editorial próprios." action={<Link href="/dashboard/blogs/new" className={buttonClass()}>Novo blog</Link>} />
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((b, i) => (
            <Card key={b.id} className={b.archived ? "opacity-60" : ""}>
              <div className="h-1.5 rounded-t-xl" style={{ background: b.brandColor }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/blogs/${b.id}`} className="font-semibold hover:underline">
                    {b.name}
                  </Link>
                  <a href={urls[i]} target="_blank" className="text-muted-foreground hover:text-foreground" aria-label="Abrir blog">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.tagline || b.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge>{b.language}</Badge>
                  <Badge color="violet">{THEME[b.theme]}</Badge>
                  <Badge color={b.aiPostStatus === "review" ? "amber" : "blue"}>IA: {b.aiPostStatus === "review" ? "revisão" : "agendado"}</Badge>
                  {b.adsEnabled && <Badge color="green">Anúncios</Badge>}
                  {b.archived && <Badge color="red">Arquivado</Badge>}
                </div>
                <p className="mt-3 truncate font-mono text-xs text-muted-foreground">{urls[i].replace(/^https?:\/\//, "")}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum blog ainda">
          Rode <code>npm run db:seed</code> para criar os 5 blogs iniciais.
        </EmptyState>
      )}
    </>
  );
}
