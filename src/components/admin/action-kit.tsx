"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, CircleAlert, GripVertical } from "lucide-react";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/* Peças das telas de gestão do painel (categorias/tags, pauta): ações sem recarregar a página,
   aviso no canto, confirmação inline e lista reordenável por arrastar/setas. */

export type Run = (action: () => Promise<ActionResult>, opts?: { onOk?: () => void; onError?: (message: string) => void }) => void;

export function useActionRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const run: Run = (action, opts = {}) => {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        setToast({ ok: true, text: res.message });
        opts.onOk?.();
      } else if (opts.onError) opts.onError(res.error);
      else setToast({ ok: false, text: res.error });
      // Também no erro: se outra aba (ou a IA via MCP) mudou os dados, a tela volta a refletir o banco
      router.refresh();
    });
  };

  const toastNode = toast && (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed right-5 bottom-5 z-50 flex max-w-sm items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg",
        toast.ok ? "border-emerald-500/30" : "border-red-500/30",
      )}
    >
      {toast.ok ? <Check className="h-4 w-4 shrink-0 text-success" /> : <CircleAlert className="h-4 w-4 shrink-0 text-danger" />}
      {toast.text}
    </div>
  );

  return { pending, run, toast: toastNode };
}

export function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
        active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
      <span className="rounded-full bg-muted px-2 text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

export function EmptyPanel({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="text-muted-foreground [&_svg]:h-8 [&_svg]:w-8">{icon}</span>
      <p className="mt-3 font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Linha de confirmação que substitui o item da lista (sem modal). */
export function ConfirmRow({
  title,
  detail,
  confirmLabel = "Excluir",
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  detail: string;
  confirmLabel?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 bg-red-500/5 px-4 py-3" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{detail}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} autoFocus>
        Cancelar
      </Button>
      <Button type="button" variant="danger" size="sm" onClick={onConfirm} disabled={pending}>
        {pending ? "Aguarde…" : confirmLabel}
      </Button>
    </li>
  );
}

/** Ordem local que responde na hora ao arrastar/setas e se ressincroniza quando o servidor manda dados novos. */
export function useSortableList<T extends { id: number }>(source: T[], onSave: (next: T[]) => void) {
  const [items, setItems] = useState(source);
  const [synced, setSynced] = useState(source);
  if (source !== synced) {
    setSynced(source);
    setItems(source);
  }
  const [dragId, setDragId] = useState<number | null>(null);

  function commit(next: T[]) {
    setItems(next);
    onSave(next);
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    commit(next);
  }

  function rowProps(id: number) {
    return {
      draggable: items.length > 1,
      onDragStart: (e: React.DragEvent) => {
        setDragId(id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(id));
      },
      onDragOver: (e: React.DragEvent) => {
        if (dragId === null) return;
        e.preventDefault();
        if (dragId === id) return;
        setItems((cur) => {
          const from = cur.findIndex((x) => x.id === dragId);
          const to = cur.findIndex((x) => x.id === id);
          if (from < 0 || to < 0) return cur;
          const next = [...cur];
          next.splice(to, 0, next.splice(from, 1)[0]);
          return next;
        });
      },
      onDragEnd: () => {
        setDragId(null);
        if (items.some((x, i) => x.id !== source[i]?.id)) commit(items);
      },
    };
  }

  return { items, dragId, move, rowProps };
}

/** Alça de arrastar + setas (as setas atendem teclado e quem não arrasta). */
export function SortControls({ index, count, label, pending, onMove }: { index: number; count: number; label: string; pending: boolean; onMove: (to: number) => void }) {
  return (
    <div className="flex shrink-0 items-center text-muted-foreground">
      {count > 1 && <GripVertical className="h-4 w-4 cursor-grab active:cursor-grabbing" aria-hidden />}
      <div className="flex flex-col">
        <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0 || pending} aria-label={`Mover ${label} para cima`} title="Mover para cima" className="rounded p-0.5 hover:bg-muted hover:text-foreground disabled:invisible">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => onMove(index + 1)} disabled={index === count - 1 || pending} aria-label={`Mover ${label} para baixo`} title="Mover para baixo" className="rounded p-0.5 hover:bg-muted hover:text-foreground disabled:invisible">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
