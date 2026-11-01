import * as React from "react";
import { cn } from "@/lib/utils";

/* Componentes base do painel no estilo shadcn/ui (Tailwind puro, sem dependências). */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "danger" | "secondary";
  size?: "sm" | "md" | "icon";
};

export function buttonClass(variant: ButtonProps["variant"] = "default", size: ButtonProps["size"] = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary whitespace-nowrap",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-9 px-4 text-sm",
    size === "icon" && "h-9 w-9",
    variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "secondary" && "bg-muted text-foreground hover:bg-muted/70",
    variant === "outline" && "border bg-card hover:bg-muted",
    variant === "ghost" && "hover:bg-muted",
    variant === "danger" && "bg-danger text-white hover:bg-danger/90",
    className,
  );
}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-card shadow-xs", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const fieldBase =
  "w-full rounded-lg border bg-card px-3 text-sm placeholder:text-muted-foreground focus:outline-2 focus:outline-primary focus:outline-offset-0";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "py-2", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "h-9", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium", className)} {...props} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const badgeColors = {
  gray: "bg-muted text-muted-foreground",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  red: "bg-red-500/10 text-red-700 dark:text-red-400",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

export function Badge({ color = "gray", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof badgeColors }) {
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", badgeColors[color], className)} {...props} />;
}

export const STATUS_LABEL: Record<string, { label: string; color: keyof typeof badgeColors }> = {
  draft: { label: "Rascunho", color: "gray" },
  review: { label: "Revisão", color: "amber" },
  scheduled: { label: "Agendado", color: "blue" },
  published: { label: "Publicado", color: "green" },
  archived: { label: "Arquivado", color: "gray" },
  idea: { label: "Na fila", color: "gray" },
  assigned: { label: "Em produção", color: "violet" },
  written: { label: "Escrito", color: "blue" },
  discarded: { label: "Descartado", color: "red" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, color: "gray" as const };
  return <Badge color={s.color}>{s.label}</Badge>;
}

export function ScoreBadge({ score }: { score: number }) {
  return <Badge color={score >= 80 ? "green" : score >= 60 ? "amber" : "red"}>{score}</Badge>;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:px-4 [&_td]:py-3 [&_tbody_tr]:border-t [&_tbody_tr:hover]:bg-muted/40">
        {children}
      </table>
    </div>
  );
}
