import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ExternalLink, Trash2 } from "lucide-react";
import { db } from "@/db";
import { authors, blogs, categories, domains } from "@/db/schema";
import { BlogForm } from "@/components/admin/blog-form";
import { Flash } from "@/components/admin/flash";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Textarea, buttonClass } from "@/components/ui";
import { config } from "@/lib/config";
import { blogBaseUrl } from "@/lib/tenant";
import {
  addDomain,
  deleteDomain,
  redirectDomainToPrimary,
  saveAuthor,
  setPrimaryDomain,
  toggleArchiveBlog,
  updateBlog,
} from "../actions";

export const metadata = { title: "Editar blog" };

export default async function EditBlogPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const id = Number((await params).id);
  const { error, saved } = await searchParams;
  const blog = await db.query.blogs.findFirst({ where: eq(blogs.id, id) });
  if (!blog) notFound();

  const [doms, cats, auths, url] = await Promise.all([
    db.select().from(domains).where(eq(domains.blogId, id)),
    db.select().from(categories).where(eq(categories.blogId, id)).orderBy(asc(categories.position)),
    db.select().from(authors).where(eq(authors.blogId, id)),
    blogBaseUrl(blog),
  ]);
  const subdomain = `${blog.slug}.${config.rootDomain}`;

  return (
    <>
      <PageHeader
        title={blog.name}
        description={blog.niche}
        action={
          <div className="flex gap-2">
            <a href={url} target="_blank" className={buttonClass("outline")}>
              <ExternalLink className="h-4 w-4" /> Ver blog
            </a>
            <Link href={`/dashboard/posts?blog=${blog.id}`} className={buttonClass("outline")}>
              Posts
            </Link>
            <form action={toggleArchiveBlog.bind(null, blog.id)}>
              <Button variant="ghost">{blog.archived ? "Reativar" : "Arquivar"}</Button>
            </form>
          </div>
        }
      />
      <Flash error={error} saved={saved} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <BlogForm blog={blog} action={updateBlog.bind(null, blog.id)} rootDomain={config.rootDomain} />

        <div className="space-y-6">
          <Card id="dominios">
            <CardHeader title="Domínios" description="Subdomínio grátis sempre funciona. Domínio próprio vira o principal." />
            <ul className="divide-y text-sm">
              <li className="flex items-center justify-between px-5 py-3">
                <span className="font-mono text-xs">{subdomain}</span>
                {!doms.some((d) => d.isPrimary) ? <Badge color="green">Principal</Badge> : <Badge>301 → principal</Badge>}
              </li>
              {doms.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs">{d.hostname}</p>
                    {d.redirectTo && <p className="text-xs text-muted-foreground">301 → {d.redirectTo}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {d.isPrimary ? (
                      <Badge color="green">Principal</Badge>
                    ) : (
                      <>
                        <form action={setPrimaryDomain.bind(null, blog.id, d.id)}>
                          <Button variant="ghost" size="sm">Principal</Button>
                        </form>
                        {!d.redirectTo && (
                          <form action={redirectDomainToPrimary.bind(null, blog.id, d.id)}>
                            <Button variant="ghost" size="sm">301</Button>
                          </form>
                        )}
                      </>
                    )}
                    <form action={deleteDomain.bind(null, blog.id, d.id)}>
                      <Button variant="ghost" size="icon" aria-label="Remover domínio">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            <form action={addDomain.bind(null, blog.id)} className="space-y-3 border-t p-5">
              <Input name="hostname" placeholder="meublog.com.br" required />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isPrimary" className="h-4 w-4" /> Tornar principal
              </label>
              <p className="text-xs text-muted-foreground">No Cloudflare, aponte o domínio (registro A/CNAME, proxy ligado) para o IP do servidor.</p>
              <Button variant="outline" size="sm">Adicionar domínio</Button>
            </form>
          </Card>

          <Card id="categorias">
            <CardHeader
              title="Categorias"
              action={
                <Link href={`/dashboard/categorias?blog=${blog.id}`} className={buttonClass("outline", "sm")}>
                  Gerenciar
                </Link>
              }
            />
            <p className="px-5 py-4 text-sm text-muted-foreground">
              {cats.length ? cats.map((c) => c.name).join(" · ") : "Nenhuma categoria. Crie em Categorias e tags."}
            </p>
          </Card>

          <Card id="autores">
            <CardHeader title="Autores" description="Use seu nome real ou um nome de redação. Não invente credenciais." />
            {[...auths, null].map((a) => (
              <form key={a?.id ?? "new"} action={saveAuthor.bind(null, blog.id)} className="space-y-3 border-b p-5 last:border-b-0">
                <input type="hidden" name="id" value={a?.id ?? ""} />
                <p className="text-xs font-medium text-muted-foreground">{a ? "Editar autor" : "Novo autor"}</p>
                <Field label="Nome">
                  <Input name="name" defaultValue={a?.name} required />
                </Field>
                <Field label="Bio">
                  <Textarea name="bio" rows={3} defaultValue={a?.bio} />
                </Field>
                <Field label="Experiência / área">
                  <Input name="expertise" defaultValue={a?.expertise} />
                </Field>
                <Field label="URL do avatar">
                  <Input name="avatarUrl" defaultValue={a?.avatarUrl ?? ""} />
                </Field>
                <Button variant="outline" size="sm">{a ? "Salvar" : "Adicionar"}</Button>
              </form>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
