"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, CircleDashed, ImageUp, Plus, Trash2, X } from "lucide-react";
import type { AffiliateProduct, FaqItem, PostStatus } from "@/db/schema";
import { TagInput } from "@/components/admin/tag-input";
import { Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { analyzeSeo } from "@/lib/seo/score";
import { markdownToPlain } from "@/lib/text";
import { normalize, slugify, slugifyTyping, cn } from "@/lib/utils";
import { createCategoryAction, previewMarkdownAction, savePostAction, uploadImageAction } from "@/app/(admin)/dashboard/posts/actions";

type EditorCategory = { id: number; name: string };

export type EditorBlog = { id: number; name: string; baseUrl: string; categories: EditorCategory[]; tags: string[] };

export type EditorPost = {
  id: number;
  blogId: number;
  title: string;
  slug: string;
  excerpt: string;
  contentMd: string;
  coverImage: string | null;
  coverAlt: string | null;
  status: PostStatus;
  publishAt: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  secondaryKeywords: string[];
  categoryId: number | null;
  canonicalUrl: string | null;
  noindex: boolean;
  faq: FaqItem[];
  affiliateProducts: AffiliateProduct[];
  sources: { title: string; url: string }[];
  tags: string[];
};

/** Date ISO → valor de <input type="datetime-local"> no fuso do navegador. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostEditor({ post, blogs, defaultBlogId }: { post?: EditorPost; blogs: EditorBlog[]; defaultBlogId?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string; warnings?: string[] } | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [previewHtml, setPreviewHtml] = useState("");

  const [blogId, setBlogId] = useState(post?.blogId ?? defaultBlogId ?? blogs[0]?.id);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [contentMd, setContentMd] = useState(post?.contentMd ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [focusKeyword, setFocusKeyword] = useState(post?.focusKeyword ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "");
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>(post?.secondaryKeywords ?? []);
  const [categoryId, setCategoryId] = useState<number | null>(post?.categoryId ?? null);
  // Categorias criadas aqui no editor entram na lista sem recarregar a página
  const [createdCats, setCreatedCats] = useState<(EditorCategory & { blogId: number })[]>([]);
  const [newCat, setNewCat] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(post?.tags ?? []);
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "draft");
  const [publishAt, setPublishAt] = useState(toLocalInput(post?.publishAt ?? null));
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
  const [coverAlt, setCoverAlt] = useState(post?.coverAlt ?? "");
  const [faq, setFaq] = useState<FaqItem[]>(post?.faq ?? []);
  const [sources, setSources] = useState(post?.sources ?? []);
  const [products, setProducts] = useState<AffiliateProduct[]>(post?.affiliateProducts ?? []);
  const [noindex, setNoindex] = useState(post?.noindex ?? false);
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonicalUrl ?? "");

  const blog = blogs.find((b) => b.id === blogId);
  const blogCategories = [...(blog?.categories ?? []), ...createdCats.filter((c) => c.blogId === blogId && !blog?.categories.some((x) => x.id === c.id))];
  const effectiveSlug = slugTouched ? slug : slugify(title);

  const seo = useMemo(
    () =>
      analyzeSeo({
        title,
        seoTitle,
        metaDescription,
        slug: effectiveSlug,
        focusKeyword,
        contentMd,
        coverImage,
        faqCount: faq.filter((f) => f.question && f.answer).length,
        hasCategory: categoryId !== null,
      }),
    [title, seoTitle, metaDescription, effectiveSlug, focusKeyword, contentMd, coverImage, faq, categoryId],
  );

  const plainContent = useMemo(() => normalize(markdownToPlain(contentMd)), [contentMd]);
  const missingSecondary = secondaryKeywords.filter((k) => !plainContent.includes(normalize(k)));

  function createCategory() {
    if (!blogId || !newCat?.trim()) return;
    startTransition(async () => {
      const res = await createCategoryAction(blogId, newCat);
      if (!res.ok) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setCreatedCats((prev) => [...prev, { ...res.category, blogId }]);
      setCategoryId(res.category.id);
      setNewCat(null);
    });
  }

  function save(nextStatus?: PostStatus) {
    if (!blogId) return;
    const st = nextStatus ?? status;
    setMessage(null);
    startTransition(async () => {
      const res = await savePostAction(post?.id ?? null, {
        blogId,
        title,
        slug: effectiveSlug,
        contentMd,
        excerpt: excerpt || undefined,
        status: st,
        publishAt: publishAt ? new Date(publishAt) : null,
        seoTitle: seoTitle || null,
        metaDescription: metaDescription || null,
        focusKeyword: focusKeyword || null,
        secondaryKeywords,
        categoryId,
        tags,
        coverImage: coverImage || null,
        coverAlt: coverAlt || null,
        faq: faq.filter((f) => f.question.trim() && f.answer.trim()),
        sources: sources.filter((s) => s.title.trim() && s.url.trim()),
        affiliateProducts: products.filter((p) => p.name.trim() && p.url.trim()),
        noindex,
        canonicalUrl: canonicalUrl || null,
      });
      if (!res.ok) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setStatus(st);
      setMessage({ type: "ok", text: `Salvo · score ${res.score}`, warnings: res.warnings });
      if (!post) router.replace(`/dashboard/posts/${res.id}`);
      else router.refresh();
    });
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("alt", coverAlt || title);
    fd.set("blogId", String(blogId ?? ""));
    const res = await uploadImageAction(fd);
    if (res.ok) setCoverImage(res.url);
    else setMessage({ type: "error", text: res.error });
  }

  const snippetTitle = (seoTitle || title || "Título do post").slice(0, 60);
  const snippetDesc = (metaDescription || excerpt || "Meta description aparece aqui…").slice(0, 160);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_200px]">
            <Field label="Título (H1)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 text-lg font-semibold" placeholder="Como consultar o saldo do FGTS pelo celular" />
            </Field>
            <Field label="Blog">
              <Select value={blogId} onChange={(e) => { setBlogId(Number(e.target.value)); setCategoryId(null); }} disabled={!!post}>
                {blogs.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
            <span className="shrink-0">{blog?.baseUrl.replace(/^https?:\/\//, "")}/</span>
            <input
              value={effectiveSlug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugifyTyping(e.target.value)); }}
              className="min-w-0 flex-1 rounded border-0 bg-transparent px-1 font-mono text-foreground outline-none hover:bg-muted focus:bg-muted"
              aria-label="Slug"
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-1 border-b px-3 pt-2">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={async () => {
                  setTab(t);
                  if (t === "preview") setPreviewHtml(await previewMarkdownAction(contentMd));
                }}
                className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t ? "border-primary font-medium" : "border-transparent text-muted-foreground")}
              >
                {t === "write" ? "Escrever (Markdown)" : "Pré-visualizar"}
              </button>
            ))}
            <span className="ml-auto pr-2 text-xs text-muted-foreground tabular-nums">{seo.wordCount} palavras</span>
          </div>
          {tab === "write" ? (
            <Textarea
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              rows={28}
              className="rounded-none rounded-b-xl border-0 font-mono text-[13px] leading-relaxed focus:outline-none"
              placeholder={"Parágrafo de abertura com a palavra-chave…\n\n## Primeiro subtítulo\n\nTexto…"}
            />
          ) : (
            <div className="prose-article max-w-none p-6" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </Card>

        <Card>
          <CardHeader title="FAQ" description="Vira FAQPage no JSON-LD." action={<Button type="button" variant="outline" size="sm" onClick={() => setFaq([...faq, { question: "", answer: "" }])}><Plus className="h-4 w-4" />Pergunta</Button>} />
          <div className="space-y-3 p-5">
            {faq.length === 0 && <p className="text-sm text-muted-foreground">Sem perguntas.</p>}
            {faq.map((f, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Input value={f.question} placeholder="Pergunta" onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
                  <Textarea value={f.answer} placeholder="Resposta" rows={2} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setFaq(faq.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Fontes" action={<Button type="button" variant="outline" size="sm" onClick={() => setSources([...sources, { title: "", url: "" }])}><Plus className="h-4 w-4" /></Button>} />
            <div className="space-y-2 p-5">
              {sources.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={s.title} placeholder="Nome" onChange={(e) => setSources(sources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Input value={s.url} placeholder="https://" onChange={(e) => setSources(sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setSources(sources.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Produtos afiliados" action={<Button type="button" variant="outline" size="sm" onClick={() => setProducts([...products, { name: "", url: "" }])}><Plus className="h-4 w-4" /></Button>} />
            <div className="space-y-3 p-5">
              {products.map((p, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex gap-2">
                    <Input value={p.name} placeholder="Produto" onChange={(e) => setProducts(products.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setProducts(products.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Input value={p.url} placeholder="Link de afiliado" onChange={(e) => setProducts(products.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  <div className="flex gap-2">
                    <Input value={p.price ?? ""} placeholder="Preço (opcional)" onChange={(e) => setProducts(products.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                    <Input value={p.image ?? ""} placeholder="URL da imagem" onChange={(e) => setProducts(products.map((x, j) => (j === i ? { ...x, image: e.target.value } : x)))} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ---------- Coluna lateral ---------- */}
      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" className="col-span-2">
              <Select value={status} onChange={(e) => setStatus(e.target.value as PostStatus)}>
                <option value="draft">Rascunho</option>
                <option value="review">Revisão</option>
                <option value="scheduled">Agendado</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </Select>
            </Field>
            {status === "scheduled" && (
              <Field label="Publicar em" className="col-span-2" hint="Vazio = próximo horário livre do blog.">
                <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
              </Field>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={() => save()} disabled={pending || !title || !contentMd} className="flex-1">
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            {status !== "published" && (
              <Button type="button" variant="outline" onClick={() => save("published")} disabled={pending || !title || !contentMd}>
                Publicar agora
              </Button>
            )}
          </div>
          {message && (
            <div className={cn("mt-3 rounded-lg px-3 py-2 text-sm", message.type === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400")}>
              {message.text}
              {message.warnings?.map((w) => <p key={w} className="mt-1 text-xs">• {w}</p>)}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Organização"
            action={
              <Link href={`/dashboard/categorias?blog=${blogId}`} target="_blank" className="text-xs text-muted-foreground hover:text-foreground">
                Gerenciar
              </Link>
            }
          />
          <div className="space-y-3 p-5">
            <Field label="Categoria" hint={blogCategories.length ? undefined : "Este blog ainda não tem categorias. Crie a primeira aqui."}>
              {newCat === null ? (
                <div className="flex gap-2">
                  <Select value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Sem categoria</option>
                    {blogCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setNewCat("")} aria-label="Nova categoria" title="Nova categoria">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); createCategory(); }
                      if (e.key === "Escape") setNewCat(null);
                    }}
                    placeholder="Nome da nova categoria"
                    maxLength={60}
                  />
                  <Button type="button" variant="outline" onClick={createCategory} disabled={pending || newCat.trim().length < 2}>Criar</Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setNewCat(null)} aria-label="Cancelar"><X className="h-4 w-4" /></Button>
                </div>
              )}
            </Field>
            <Field label={`Tags (${tags.length}/15)`} hint="Enter ou vírgula para adicionar. Reaproveite as tags sugeridas em vez de criar variações.">
              <TagInput value={tags} onChange={setTags} suggestions={blog?.tags} prefix="#" placeholder="ex.: fgts, imposto de renda" aria-label="Tags" />
            </Field>
            <Field label="Resumo (excerpt)" hint="Aparece nas listagens. Vazio = gerado do 1º parágrafo.">
              <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} maxLength={320} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4 border-b px-5 py-4">
            <ScoreRing score={seo.score} />
            <div>
              <p className="font-semibold">Score SEO</p>
              <p className="text-xs text-muted-foreground">{seo.checks.filter((c) => c.ok).length} de {seo.checks.length} critérios</p>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <Field label="Palavra-chave foco">
              <Input value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} placeholder="consultar saldo fgts" />
            </Field>
            <Field
              label="Palavras-chave secundárias"
              hint={
                missingSecondary.length && contentMd ? (
                  <span className="text-warning">Ainda não aparecem no texto: {missingSecondary.join(", ")}</span>
                ) : (
                  "Sinônimos e variações da busca. Use-as em subtítulos e ao longo do texto."
                )
              }
            >
              <TagInput value={secondaryKeywords} onChange={setSecondaryKeywords} max={20} placeholder="saldo fgts app, extrato fgts" aria-label="Palavras-chave secundárias" />
            </Field>
            <Field label={`Título SEO (${(seoTitle || title).length}/60)`}>
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} />
            </Field>
            <Field label={`Meta description (${metaDescription.length}/160)`}>
              <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3} />
            </Field>
            <div className="rounded-lg border bg-background p-3">
              <p className="truncate text-xs text-muted-foreground">{blog?.baseUrl.replace(/^https?:\/\//, "")} › {effectiveSlug}</p>
              <p className="mt-0.5 line-clamp-1 text-[15px] text-[#1a0dab] dark:text-[#8ab4f8]">{snippetTitle}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{snippetDesc}</p>
            </div>
          </div>
          <ul className="space-y-1.5 border-t px-5 py-4 text-sm">
            {seo.checks.map((c) => (
              <li key={c.id} className="flex gap-2" title={c.hint}>
                {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : c.partial ? <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                <span className={c.ok ? "text-muted-foreground" : ""}>{c.label}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-5">
          <Label2>Imagem de capa</Label2>
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt={coverAlt} className="aspect-video w-full rounded-lg object-cover" />
          )}
          <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="/api/media/... ou https://" />
          <Input value={coverAlt} onChange={(e) => setCoverAlt(e.target.value)} placeholder="Texto alternativo (alt)" />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <ImageUp className="h-4 w-4" /> Enviar imagem
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </Card>

        <Card className="space-y-3 p-5">
          <Field label="URL canônica (opcional)">
            <Input value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} className="h-4 w-4" /> Não indexar (noindex)
          </label>
        </Card>
      </div>
    </div>
  );
}

function Label2({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>;
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--danger)";
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`Score ${score}`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{score}</text>
    </svg>
  );
}
