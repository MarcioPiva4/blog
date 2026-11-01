"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Archive, ArrowUpToLine, CircleCheck, FileText, Layers, ListOrdered, PenLine, Pencil, Plus, RotateCcw, StickyNote, Trash2 } from "lucide-react";
import type { PostStatus, TopicStatus } from "@/db/schema";
import { ConfirmRow, EmptyPanel, SortControls, TabButton, useActionRunner, useSortableList, type Run } from "@/components/admin/action-kit";
import { Badge, Button, Card, Input, Label, StatusBadge, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addTopicsAction, deleteTopicAction, reorderTopicsAction, setTopicStatusAction, updateTopicAction } from "@/app/(admin)/dashboard/pauta/actions";

export type TopicBlog = { id: number; name: string; brandColor: string; queued: number };
export type TopicRow = {
  id: number;
  keyword: string;
  title: string;
  intent: string;
  cluster: string;
  notes: string;
  status: TopicStatus;
  assignedAt: Date | null;
  updatedAt: Date;
  postId: number | null;
  postTitle: string | null;
  postStatus: PostStatus | null;
};
type TopicFields = { keyword: string; title: string; intent: string; cluster: string; notes: string };
type Position = "start" | "end";

const TABS: { status: TopicStatus; label: string; icon: React.ReactNode; help: string }[] = [
  {
    status: "idea",
    label: "Na fila",
    icon: <ListOrdered className="h-4 w-4" />,
    help: "A IA escreve sempre a primeira pauta da fila deste blog. Arraste ou use as setas para mudar a ordem.",
  },
  {
    status: "assigned",
    label: "Em produção",
    icon: <PenLine className="h-4 w-4" />,
    help: "Pautas que a IA pegou e está escrevendo. Se não virarem post em 24 horas, voltam sozinhas para a fila.",
  },
  { status: "written", label: "Escritas", icon: <FileText className="h-4 w-4" />, help: "A IA já escreveu o post; ele está em revisão ou agendado." },
  { status: "published", label: "Publicadas", icon: <CircleCheck className="h-4 w-4" />, help: "Pautas que já viraram posts publicados." },
  {
    status: "discarded",
    label: "Descartadas",
    icon: <Archive className="h-4 w-4" />,
    help: "Fora da fila. Restaure para devolver à fila, ou exclua de vez para poder usar a palavra-chave de novo.",
  },
];

const DEFAULT_INTENTS = ["Informacional", "Tutorial (passo a passo)", "Comparativo", "Lista", "Review", "Transacional"];
const uniq = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

function timeAgo(date: Date) {
  const min = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
}

export function TopicManager({ blogs, blogId, topics, initialStatus }: { blogs: TopicBlog[]; blogId: number; topics: TopicRow[]; initialStatus: TopicStatus }) {
  const { pending, run, toast } = useActionRunner();
  const [status, setStatus] = useState<TopicStatus>(initialStatus);
  const [adding, setAdding] = useState(false);
  const tab = TABS.find((t) => t.status === status)!;
  const visible = topics.filter((t) => t.status === status);
  const existing = new Set(topics.map((t) => t.keyword));

  function switchStatus(next: TopicStatus) {
    setStatus(next);
    window.history.replaceState(null, "", `?blog=${blogId}&status=${next}`);
  }

  const listProps = { blogId, pending, run, onAdd: () => setAdding(true) };

  return (
    <>
      {blogs.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Blog">
          {blogs.map((b) => (
            <Link
              key={b.id}
              href={`?blog=${b.id}&status=${status}`}
              aria-current={b.id === blogId ? "page" : undefined}
              title={`${b.queued} na fila`}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                b.id === blogId ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: b.brandColor }} />
              {b.name}
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{b.queued}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b" role="tablist">
        {TABS.map((t) => (
          <TabButton key={t.status} active={status === t.status} onClick={() => switchStatus(t.status)} icon={t.icon} label={t.label} count={topics.filter((x) => x.status === t.status).length} />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-2xl text-sm text-muted-foreground">{tab.help}</p>
          {!adding && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Nova pauta
            </Button>
          )}
        </div>

        {adding && (
          <AddTopics
            blogId={blogId}
            existing={existing}
            pending={pending}
            run={run}
            onCancel={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              switchStatus("idea");
            }}
          />
        )}

        <Card>
          {status === "idea" && <QueueList topics={visible} existing={existing} {...listProps} />}
          {status === "assigned" && <AssignedList topics={[...visible].sort((a, b) => +new Date(a.assignedAt ?? 0) - +new Date(b.assignedAt ?? 0))} {...listProps} />}
          {(status === "written" || status === "published") && <DoneList topics={[...visible].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))} status={status} />}
          {status === "discarded" && <DiscardedList topics={[...visible].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))} {...listProps} />}
        </Card>
      </div>

      {/* Sugestões dos campos Intenção e Cluster (as já usadas neste blog + padrões) */}
      <datalist id="topic-intents">
        {uniq([...DEFAULT_INTENTS, ...topics.map((t) => t.intent)]).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="topic-clusters">
        {uniq(topics.map((t) => t.cluster)).map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      {toast}
    </>
  );
}

// ---------------------------------------------------------------- Listas

type ListProps = { blogId: number; pending: boolean; run: Run; onAdd: () => void };

function QueueList({ blogId, topics, existing, pending, run, onAdd }: ListProps & { topics: TopicRow[]; existing: Set<string> }) {
  const { items, dragId, move, rowProps } = useSortableList(topics, (next) => run(() => reorderTopicsAction(blogId, next.map((t) => t.id))));
  const [editingId, setEditingId] = useState<number | null>(null);

  if (!items.length) {
    return (
      <EmptyPanel
        icon={<ListOrdered />}
        title="A fila está vazia"
        action={
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4" /> Adicionar pautas
          </Button>
        }
      >
        Adicione palavras-chave para a IA escrever. Ela pega sempre a primeira da fila.
      </EmptyPanel>
    );
  }

  return (
    <ul className="divide-y">
      {items.map((t, i) =>
        editingId === t.id ? (
          <li key={t.id} className="bg-muted/30 p-5">
            <p className="mb-4 font-semibold">Editar pauta</p>
            <TopicForm
              initial={t}
              existing={existing}
              pending={pending}
              submitLabel="Salvar alterações"
              onCancel={() => setEditingId(null)}
              onSubmit={(data, setError) => run(() => updateTopicAction(blogId, { ...data, id: t.id }), { onOk: () => setEditingId(null), onError: setError })}
            />
          </li>
        ) : (
          <li key={t.id} {...rowProps(t.id)} className={cn("flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40", dragId === t.id && "bg-primary/5 opacity-60")}>
            <SortControls index={i} count={items.length} label={t.keyword} pending={pending} onMove={(to) => move(i, to)} />
            <span className="w-8 shrink-0 text-center text-sm font-medium tabular-nums text-muted-foreground">{i + 1}º</span>
            <TopicSummary topic={t} badge={i === 0 ? <Badge color="violet">Próxima</Badge> : null} onAddTitle={() => setEditingId(t.id)} />
            <div className="flex shrink-0 items-center">
              {i > 0 && (
                <Button variant="ghost" size="icon" onClick={() => move(i, 0)} disabled={pending} aria-label={`Mover ${t.keyword} para o topo`} title="Mover para o topo (vira a próxima)">
                  <ArrowUpToLine className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setEditingId(t.id)} aria-label={`Editar ${t.keyword}`} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => run(() => setTopicStatusAction(blogId, t.id, "discarded"))}
                disabled={pending}
                aria-label={`Descartar ${t.keyword}`}
                title="Descartar (dá para restaurar depois)"
                className="hover:text-danger"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

function AssignedList({ blogId, topics, pending, run }: ListProps & { topics: TopicRow[] }) {
  if (!topics.length) return <EmptyPanel icon={<PenLine />} title="Nada em produção">Quando a IA pegar uma pauta da fila, ela aparece aqui até virar post.</EmptyPanel>;
  return (
    <ul className="divide-y">
      {topics.map((t) => {
        const hoursLeft = t.assignedAt ? 24 - (Date.now() - new Date(t.assignedAt).getTime()) / 3_600_000 : 0;
        return (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <TopicSummary topic={t}>
              {t.assignedAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A IA pegou {timeAgo(t.assignedAt)} · {hoursLeft > 1 ? `volta sozinha para a fila em ~${Math.ceil(hoursLeft)} h` : "volta para a fila no próximo pedido da IA"}
                </p>
              )}
            </TopicSummary>
            <Button variant="outline" size="sm" onClick={() => run(() => setTopicStatusAction(blogId, t.id, "idea"))} disabled={pending}>
              <RotateCcw className="h-4 w-4" /> Devolver à fila
            </Button>
            <Button variant="ghost" size="icon" onClick={() => run(() => setTopicStatusAction(blogId, t.id, "discarded"))} disabled={pending} aria-label={`Descartar ${t.keyword}`} title="Descartar" className="hover:text-danger">
              <Archive className="h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function DoneList({ topics, status }: { topics: TopicRow[]; status: "written" | "published" }) {
  if (!topics.length) {
    return (
      <EmptyPanel icon={status === "written" ? <FileText /> : <CircleCheck />} title={status === "written" ? "Nenhuma pauta escrita aguardando" : "Nenhuma pauta publicada ainda"}>
        As pautas chegam aqui sozinhas quando a IA cria o post.
      </EmptyPanel>
    );
  }
  return (
    <ul className="divide-y">
      {topics.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <TopicSummary topic={t} />
          {t.postId && (
            <Link href={`/dashboard/posts/${t.postId}`} className="flex min-w-0 max-w-xs items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
              {t.postStatus && <StatusBadge status={t.postStatus} />}
              <span className="truncate">{t.postTitle ?? "Abrir post"}</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function DiscardedList({ blogId, topics, pending, run }: ListProps & { topics: TopicRow[] }) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  if (!topics.length) return <EmptyPanel icon={<Archive />} title="Nenhuma pauta descartada" />;
  return (
    <ul className="divide-y">
      {topics.map((t) =>
        deletingId === t.id ? (
          <ConfirmRow
            key={t.id}
            title={`Excluir a pauta “${t.keyword}” de vez?`}
            detail="Ela some da lista e a palavra-chave poderá ser adicionada de novo."
            pending={pending}
            onCancel={() => setDeletingId(null)}
            onConfirm={() => run(() => deleteTopicAction(blogId, t.id), { onOk: () => setDeletingId(null) })}
          />
        ) : (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <TopicSummary topic={t} />
            <Button variant="outline" size="sm" onClick={() => run(() => setTopicStatusAction(blogId, t.id, "idea"))} disabled={pending}>
              <RotateCcw className="h-4 w-4" /> Restaurar
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeletingId(t.id)} aria-label={`Excluir ${t.keyword}`} title="Excluir de vez" className="hover:text-danger">
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ),
      )}
    </ul>
  );
}

function TopicSummary({ topic, badge, onAddTitle, children }: { topic: TopicRow; badge?: React.ReactNode; onAddTitle?: () => void; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium">{topic.keyword}</span>
        {badge}
        {topic.intent && <Badge color="blue" title="Intenção de busca">{topic.intent}</Badge>}
        {topic.cluster && (
          <Badge title="Cluster (grupo de assunto)">
            <Layers className="mr-1 h-3 w-3" />
            {topic.cluster}
          </Badge>
        )}
      </div>
      {topic.title ? (
        <p className="truncate text-sm text-muted-foreground" title={topic.title}>{topic.title}</p>
      ) : (
        onAddTitle && (
          <button type="button" onClick={onAddTitle} className="text-sm text-muted-foreground hover:text-primary hover:underline">
            + Sugerir um título
          </button>
        )
      )}
      {topic.notes && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground" title={topic.notes}>
          <StickyNote className="h-3 w-3 shrink-0" />
          <span className="truncate">{topic.notes}</span>
        </p>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Adicionar / editar

function AddTopics({ blogId, existing, pending, run, onDone, onCancel }: { blogId: number; existing: Set<string>; pending: boolean; run: Run; onDone: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<"one" | "many">("one");
  const [position, setPosition] = useState<Position>("end");

  const positionPicker = (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Onde entra na fila</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="topic-position" checked={position === "end"} onChange={() => setPosition("end")} className="h-4 w-4" /> No fim
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="topic-position" checked={position === "start"} onChange={() => setPosition("start")} className="h-4 w-4" /> No início (a IA escreve primeiro)
        </label>
      </div>
    </fieldset>
  );

  const submit = (topics: TopicFields[], setError: (message: string) => void) => run(() => addTopicsAction(blogId, topics, position), { onOk: onDone, onError: setError });

  return (
    <Card className="border-primary/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">Nova pauta</p>
        <div className="inline-flex rounded-lg border p-0.5 text-sm" role="tablist">
          {(["one", "many"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn("rounded-md px-3 py-1 transition-colors", mode === m ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {m === "one" ? "Uma pauta" : "Várias de uma vez"}
            </button>
          ))}
        </div>
      </div>
      {mode === "one" ? (
        <TopicForm existing={existing} pending={pending} submitLabel="Adicionar à fila" extra={positionPicker} onCancel={onCancel} onSubmit={(data, setError) => submit([data], setError)} />
      ) : (
        <BulkTopicsForm existing={existing} pending={pending} extra={positionPicker} onCancel={onCancel} onSubmit={submit} />
      )}
    </Card>
  );
}

function TopicForm({
  initial,
  existing,
  pending,
  submitLabel,
  extra,
  onSubmit,
  onCancel,
}: {
  initial?: TopicRow;
  existing: Set<string>;
  pending: boolean;
  submitLabel: string;
  extra?: React.ReactNode;
  onSubmit: (data: TopicFields, setError: (message: string) => void) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<TopicFields>({
    keyword: initial?.keyword ?? "",
    title: initial?.title ?? "",
    intent: initial?.intent ?? "",
    cluster: initial?.cluster ?? "",
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof TopicFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setData({ ...data, [key]: e.target.value });
  const kw = data.keyword.trim().toLowerCase();
  const duplicate = kw !== initial?.keyword && existing.has(kw);
  const fid = initial?.id ?? "new";

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    onSubmit(data, setError);
  }

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor={`tp-kw-${fid}`}>Palavra-chave</Label>
          <Input id={`tp-kw-${fid}`} autoFocus value={data.keyword} onChange={set("keyword")} maxLength={120} placeholder="ex.: consultar saldo fgts" required />
          {duplicate ? (
            <p className="mt-1 text-xs text-warning">Essa palavra-chave já está na pauta deste blog.</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">O termo que as pessoas buscam no Google.</p>
          )}
        </div>
        <div>
          <Label htmlFor={`tp-title-${fid}`}>
            Título sugerido <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id={`tp-title-${fid}`} value={data.title} onChange={set("title")} maxLength={200} placeholder="ex.: Como consultar o saldo do FGTS pelo celular" />
          <p className="mt-1 text-xs text-muted-foreground">A IA usa como ponto de partida.</p>
        </div>
        <div>
          <Label htmlFor={`tp-intent-${fid}`}>
            Intenção <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id={`tp-intent-${fid}`} list="topic-intents" value={data.intent} onChange={set("intent")} maxLength={60} placeholder="Escolha ou digite" />
          <p className="mt-1 text-xs text-muted-foreground">O que a pessoa quer: aprender, comparar, comprar…</p>
        </div>
        <div>
          <Label htmlFor={`tp-cluster-${fid}`}>
            Cluster <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id={`tp-cluster-${fid}`} list="topic-clusters" value={data.cluster} onChange={set("cluster")} maxLength={60} placeholder="ex.: FGTS" />
          <p className="mt-1 text-xs text-muted-foreground">Agrupa pautas do mesmo assunto (ajuda nos links internos).</p>
        </div>
      </div>
      <div>
        <Label htmlFor={`tp-notes-${fid}`}>
          Instruções para a IA <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea id={`tp-notes-${fid}`} rows={2} value={data.notes} onChange={set("notes")} maxLength={2000} placeholder="ex.: citar a regra nova de 2026, incluir tabela comparando os bancos, linkar para o post de saque-aniversário" />
      </div>
      {extra}
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={pending || kw.length < 2 || duplicate}>{pending ? "Salvando…" : submitLabel}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

type BulkRow = TopicFields & { state: "new" | "exists" | "dupe" | "short" };

/** Uma linha por pauta; campos opcionais na mesma linha separados por "|". */
function parseBulk(text: string, existing: Set<string>): BulkRow[] {
  const seen = new Set<string>();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [keyword = "", title = "", intent = "", cluster = ""] = line.split("|").map((s) => s.trim());
      const kw = keyword.toLowerCase();
      const state: BulkRow["state"] = kw.length < 2 ? "short" : existing.has(kw) ? "exists" : seen.has(kw) ? "dupe" : "new";
      seen.add(kw);
      return { keyword: kw, title, intent, cluster, notes: "", state };
    });
}

const BULK_STATE_LABEL: Record<Exclude<BulkRow["state"], "new">, string> = { exists: "já está na pauta", dupe: "repetida", short: "muito curta" };

function BulkTopicsForm({
  existing,
  pending,
  extra,
  onSubmit,
  onCancel,
}: {
  existing: Set<string>;
  pending: boolean;
  extra: React.ReactNode;
  onSubmit: (topics: TopicFields[], setError: (message: string) => void) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rows = parseBulk(text, existing);
  const valid = rows.filter((r) => r.state === "new");
  const ignored = rows.length - valid.length;
  const tooMany = valid.length > 200;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        onSubmit(valid.map(({ state: _state, ...t }) => t), setError);
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="tp-bulk">Palavras-chave, uma por linha</Label>
        <Textarea
          id="tp-bulk"
          autoFocus
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-sm"
          placeholder={"consultar saldo fgts\nsaque aniversário fgts\nfgts atrasado o que fazer | O que fazer quando o FGTS não é depositado | Tutorial | FGTS"}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Só a palavra-chave já basta. Se quiser, complete na mesma linha separando com <code className="rounded bg-muted px-1">|</code>: palavra-chave | título sugerido |
          intenção | cluster. A ordem das linhas vira a ordem na fila.
        </p>
      </div>

      {rows.length > 0 && (
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            Prévia: {valid.length} {valid.length === 1 ? "pauta nova" : "pautas novas"}
            {ignored > 0 && ` · ${ignored} ${ignored === 1 ? "será ignorada" : "serão ignoradas"}`}
          </p>
          <ul className="max-h-56 divide-y overflow-y-auto text-sm">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span className={cn("shrink-0 font-medium", r.state !== "new" && "text-muted-foreground line-through")}>{r.keyword || "—"}</span>
                {r.title && <span className="truncate text-muted-foreground">— {r.title}</span>}
                {r.intent && <Badge color="blue">{r.intent}</Badge>}
                {r.cluster && <Badge>{r.cluster}</Badge>}
                {r.state !== "new" && <span className="ml-auto shrink-0 text-xs text-warning">{BULK_STATE_LABEL[r.state]}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {extra}
      {tooMany && <p className="text-sm text-warning">Máximo de 200 pautas por vez. Divida em partes.</p>}
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={pending || valid.length === 0 || tooMany}>
          {pending ? "Adicionando…" : valid.length > 1 ? `Adicionar ${valid.length} pautas` : "Adicionar à fila"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
