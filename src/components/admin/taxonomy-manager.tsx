"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ExternalLink, FolderOpen, GripVertical, Hash, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { ConfirmRow, EmptyPanel, SortControls, TabButton, useActionRunner, useSortableList, type Run } from "@/components/admin/action-kit";
import { Badge, Button, Card, Input, Label, Textarea, buttonClass } from "@/components/ui";
import { cn, normalize, slugify, slugifyTyping } from "@/lib/utils";
import {
  createTagsAction,
  deleteCategoryAction,
  deleteTagAction,
  reorderCategoriesAction,
  saveCategoryAction,
  saveTagAction,
} from "@/app/(admin)/dashboard/categorias/actions";

export type TaxonomyBlog = { id: number; name: string; brandColor: string };
export type TaxonomyCategory = { id: number; name: string; slug: string; description: string; posts: number; published: number };
export type TaxonomyTag = { id: number; name: string; slug: string; posts: number; published: number };
export type TaxonomyTab = "categories" | "tags";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function TaxonomyManager({
  blogs,
  blogId,
  baseUrl,
  categories,
  tags,
  tagIndexMin,
  initialTab,
}: {
  blogs: TaxonomyBlog[];
  blogId: number;
  baseUrl: string;
  categories: TaxonomyCategory[];
  tags: TaxonomyTag[];
  tagIndexMin: number;
  initialTab: TaxonomyTab;
}) {
  const { pending, run, toast } = useActionRunner();
  const [tab, setTab] = useState<TaxonomyTab>(initialTab);

  function switchTab(next: TaxonomyTab) {
    setTab(next);
    window.history.replaceState(null, "", `?blog=${blogId}&tab=${next}`);
  }

  return (
    <>
      {blogs.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Blog">
          {blogs.map((b) => (
            <Link
              key={b.id}
              href={`?blog=${b.id}&tab=${tab}`}
              aria-current={b.id === blogId ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                b.id === blogId ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: b.brandColor }} />
              {b.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="mb-5 flex gap-1 border-b" role="tablist">
        <TabButton active={tab === "categories"} onClick={() => switchTab("categories")} icon={<FolderOpen className="h-4 w-4" />} label="Categorias" count={categories.length} />
        <TabButton active={tab === "tags"} onClick={() => switchTab("tags")} icon={<Hash className="h-4 w-4" />} label="Tags" count={tags.length} />
      </div>

      {tab === "categories" ? (
        <CategoriesPanel blogId={blogId} baseUrl={baseUrl} categories={categories} pending={pending} run={run} />
      ) : (
        <TagsPanel blogId={blogId} baseUrl={baseUrl} tags={tags} tagIndexMin={tagIndexMin} pending={pending} run={run} />
      )}

      {toast}
    </>
  );
}

// ---------------------------------------------------------------- Categorias

function CategoriesPanel({ blogId, baseUrl, categories, pending, run }: { blogId: number; baseUrl: string; categories: TaxonomyCategory[]; pending: boolean; run: Run }) {
  const { items, dragId, move, rowProps } = useSortableList(categories, (next) => run(() => reorderCategoriesAction(blogId, next.map((c) => c.id))));
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const host = baseUrl.replace(/^https?:\/\//, "");

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Categorias são as seções do blog.</span> Cada post fica em uma só, e elas aparecem no menu nesta ordem. Arraste
          pela alça <GripVertical className="inline h-3.5 w-3.5 align-[-2px]" /> ou use as setas para reordenar.
        </p>
        {!creating && (
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        )}
      </div>

      {creating && (
        <Card className="border-primary/40 p-5">
          <p className="mb-4 font-semibold">Nova categoria</p>
          <CategoryForm
            host={host}
            pending={pending}
            submitLabel="Criar categoria"
            onCancel={() => setCreating(false)}
            onSubmit={(data, setError) => run(() => saveCategoryAction(blogId, data), { onOk: () => setCreating(false), onError: setError })}
          />
        </Card>
      )}

      <Card>
        {items.length === 0 ? (
          <EmptyPanel
            icon={<FolderOpen />}
            title="Nenhuma categoria ainda"
            action={
              !creating && (
                <Button onClick={startCreate}>
                  <Plus className="h-4 w-4" /> Criar a primeira categoria
                </Button>
              )
            }
          >
            Crie as seções do blog, como “Investimentos” ou “Cartão de crédito”, para organizar os posts e montar o menu.
          </EmptyPanel>
        ) : (
          <ul className="divide-y">
            {items.map((c, i) => {
              if (editingId === c.id) {
                return (
                  <li key={c.id} className="bg-muted/30 p-5">
                    <p className="mb-4 font-semibold">Editar categoria</p>
                    <CategoryForm
                      initial={c}
                      host={host}
                      pending={pending}
                      submitLabel="Salvar alterações"
                      onCancel={() => setEditingId(null)}
                      onSubmit={(data, setError) => run(() => saveCategoryAction(blogId, { ...data, id: c.id }), { onOk: () => setEditingId(null), onError: setError })}
                    />
                  </li>
                );
              }
              if (deletingId === c.id) {
                return (
                  <ConfirmRow
                    key={c.id}
                    title={`Excluir a categoria “${c.name}”?`}
                    detail={c.posts ? `${plural(c.posts, "post ficará", "posts ficarão")} sem categoria. Os posts não são apagados.` : "Nenhum post usa esta categoria."}
                    pending={pending}
                    onCancel={() => setDeletingId(null)}
                    onConfirm={() => run(() => deleteCategoryAction(blogId, c.id), { onOk: () => setDeletingId(null) })}
                  />
                );
              }
              return (
                <li key={c.id} {...rowProps(c.id)} className={cn("flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40", dragId === c.id && "bg-primary/5 opacity-60")}>
                  <SortControls index={i} count={items.length} label={c.name} pending={pending} onMove={(to) => move(i, to)} />

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 font-medium">{c.name}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">/categoria/{c.slug}</span>
                    </div>
                    {c.description ? (
                      <p className="truncate text-sm text-muted-foreground" title={c.description}>{c.description}</p>
                    ) : (
                      <button type="button" onClick={() => { setEditingId(c.id); setCreating(false); }} className="text-sm text-muted-foreground hover:text-primary hover:underline">
                        + Adicionar descrição <span className="text-xs">(aparece no Google)</span>
                      </button>
                    )}
                  </div>

                  <span className="hidden shrink-0 text-sm tabular-nums text-muted-foreground sm:inline">{plural(c.posts, "post", "posts")}</span>

                  <div className="flex shrink-0 items-center">
                    {c.published > 0 && (
                      <a href={`${baseUrl}/categoria/${c.slug}`} target="_blank" className={buttonClass("ghost", "icon")} aria-label={`Ver ${c.name} no blog`} title="Ver no blog">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setCreating(false); setDeletingId(null); }} aria-label={`Editar ${c.name}`} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingId(c.id); setEditingId(null); }} aria-label={`Excluir ${c.name}`} title="Excluir" className="hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CategoryForm({
  initial,
  host,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: TaxonomyCategory;
  host: string;
  pending: boolean;
  submitLabel: string;
  onSubmit: (data: { name: string; slug: string; description: string }, setError: (message: string) => void) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [showSlug, setShowSlug] = useState(false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugChanged = !!initial && slugify(effectiveSlug) !== initial.slug;
  const fid = initial?.id ?? "new";

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    onSubmit({ name, slug: slugify(effectiveSlug), description }, setError);
  }

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="space-y-4">
      <div>
        <Label htmlFor={`cat-name-${fid}`}>Nome</Label>
        <Input id={`cat-name-${fid}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="ex.: Investimentos" required />
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          Endereço: <span className="break-all font-mono text-foreground">{host}/categoria/{effectiveSlug || "…"}</span>
          {!showSlug && (
            <button type="button" onClick={() => setShowSlug(true)} className="text-primary hover:underline">
              alterar
            </button>
          )}
        </p>
      </div>

      {showSlug && (
        <div>
          <Label htmlFor={`cat-slug-${fid}`}>Endereço (slug)</Label>
          <Input id={`cat-slug-${fid}`} value={effectiveSlug} onChange={(e) => { setSlugTouched(true); setSlug(slugifyTyping(e.target.value)); }} className="font-mono" placeholder="investimentos" />
          <p className="mt-1 text-xs text-muted-foreground">Só letras minúsculas, números e hífen.</p>
          {slugChanged && initial.published > 0 && <p className="mt-1 text-xs text-warning">Mudar o endereço quebra links que já apontam para esta página.</p>}
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <Label htmlFor={`cat-desc-${fid}`} className="mb-0">
            Descrição <span className="font-normal text-muted-foreground">(opcional, recomendada)</span>
          </Label>
          <DescriptionCounter length={description.length} />
        </div>
        <Textarea
          id={`cat-desc-${fid}`}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          placeholder="ex.: Guias práticos para começar a investir com pouco dinheiro, comparar aplicações e fugir de armadilhas."
        />
        <p className="mt-1 text-xs text-muted-foreground">Aparece no topo da página da categoria e no Google, abaixo do título. Ideal: 120 a 160 caracteres.</p>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <Button disabled={pending || name.trim().length < 2}>{pending ? "Salvando…" : submitLabel}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function DescriptionCounter({ length }: { length: number }) {
  const color = length === 0 ? "text-muted-foreground" : length >= 120 && length <= 160 ? "text-success" : "text-warning";
  return <span className={cn("text-xs tabular-nums", color)}>{length}/160</span>;
}

// ---------------------------------------------------------------- Tags

function TagsPanel({ blogId, baseUrl, tags, tagIndexMin, pending, run }: { blogId: number; baseUrl: string; tags: TaxonomyTag[]; tagIndexMin: number; pending: boolean; run: Run }) {
  const [draft, setDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const names = draft.split(",").map((s) => s.trim()).filter(Boolean);
  const visible = query.trim() ? tags.filter((t) => normalize(t.name).includes(normalize(query))) : tags;

  function add(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    run(() => createTagsAction(blogId, names), { onOk: () => setDraft(""), onError: setAddError });
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Tags são assuntos específicos.</span> Um post pode ter várias, como “FGTS” ou “Imposto de Renda 2026”. A página de
        uma tag só entra no Google quando ela tem {tagIndexMin} ou mais posts publicados, para não criar páginas rasas.
      </p>

      <Card className="p-4">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setAddError(null); }}
            placeholder="Novas tags, separadas por vírgula (ex.: fgts, saque-aniversário)"
            className="min-w-60 flex-1"
            maxLength={400}
            aria-label="Novas tags"
          />
          <Button disabled={pending || names.length === 0}>
            <Plus className="h-4 w-4" /> {names.length > 1 ? `Adicionar ${names.length} tags` : "Adicionar"}
          </Button>
        </form>
        {addError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">{addError}</p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Dica: você também pode criar tags direto no editor do post, no campo Tags.</p>
        )}
      </Card>

      <Card>
        {tags.length > 8 && (
          <div className="relative border-b p-3">
            <Search className="pointer-events-none absolute top-1/2 left-6 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar entre ${tags.length} tags…`} className="pl-9" aria-label="Buscar tags" />
          </div>
        )}
        {tags.length === 0 ? (
          <EmptyPanel icon={<Hash />} title="Nenhuma tag ainda">
            Adicione acima ou direto no editor do post. As tags ajudam o leitor a achar outros posts do mesmo assunto.
          </EmptyPanel>
        ) : visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma tag encontrada para “{query}”.</p>
        ) : (
          <ul className="divide-y">
            {visible.map((tg) => {
              if (editingId === tg.id) {
                return (
                  <li key={tg.id} className="bg-muted/30 p-5">
                    <TagForm
                      initial={tg}
                      pending={pending}
                      onCancel={() => setEditingId(null)}
                      onSubmit={(data, setError) => run(() => saveTagAction(blogId, { ...data, id: tg.id }), { onOk: () => setEditingId(null), onError: setError })}
                    />
                  </li>
                );
              }
              if (deletingId === tg.id) {
                return (
                  <ConfirmRow
                    key={tg.id}
                    title={`Excluir a tag #${tg.name}?`}
                    detail={tg.posts ? `Ela será removida de ${plural(tg.posts, "post", "posts")}. Os posts não são apagados.` : "Nenhum post usa esta tag."}
                    pending={pending}
                    onCancel={() => setDeletingId(null)}
                    onConfirm={() => run(() => deleteTagAction(blogId, tg.id), { onOk: () => setDeletingId(null) })}
                  />
                );
              }
              const indexed = tg.published >= tagIndexMin;
              return (
                <li key={tg.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/40">
                  <div className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="shrink-0 font-medium">#{tg.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">/tag/{tg.slug}</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">{plural(tg.posts, "post", "posts")}</span>
                  <Badge
                    color={indexed ? "green" : "gray"}
                    title={indexed ? "A página desta tag pode aparecer no Google" : `Precisa de ${tagIndexMin} posts publicados (tem ${tg.published})`}
                  >
                    {indexed ? "No Google" : `Fora do Google · faltam ${tagIndexMin - tg.published}`}
                  </Badge>
                  <div className="flex shrink-0 items-center">
                    {tg.published > 0 && (
                      <a href={`${baseUrl}/tag/${tg.slug}`} target="_blank" className={buttonClass("ghost", "icon")} aria-label={`Ver #${tg.name} no blog`} title="Ver no blog">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { setEditingId(tg.id); setDeletingId(null); }} aria-label={`Editar #${tg.name}`} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingId(tg.id); setEditingId(null); }} aria-label={`Excluir #${tg.name}`} title="Excluir" className="hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TagForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: TaxonomyTag;
  pending: boolean;
  onSubmit: (data: { name: string; slug: string }, setError: (message: string) => void) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  // Slug acompanha o nome enquanto não for personalizado (renomear para uma tag existente une as duas)
  const [slugTouched, setSlugTouched] = useState(initial.slug !== slugify(initial.name));
  const [error, setError] = useState<string | null>(null);
  const effectiveSlug = slugTouched ? slug : slugify(name);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setError(null); onSubmit({ name, slug: slugify(effectiveSlug) }, setError); }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="space-y-4"
    >
      <p className="font-semibold">Editar tag</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`tag-name-${initial.id}`}>Nome</Label>
          <Input id={`tag-name-${initial.id}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        </div>
        <div>
          <Label htmlFor={`tag-slug-${initial.id}`}>Endereço (slug)</Label>
          <Input id={`tag-slug-${initial.id}`} value={effectiveSlug} onChange={(e) => { setSlugTouched(true); setSlug(slugifyTyping(e.target.value)); }} className="font-mono" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Se já existir outra tag com esse nome, as duas são unidas e os posts passam para a que já existe.</p>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={pending || !name.trim()}>{pending ? "Salvando…" : "Salvar alterações"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
