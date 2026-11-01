"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { cn, slugify } from "@/lib/utils";

/** Lista de termos em chips: Enter ou vírgula adiciona, Backspace no campo vazio remove o último. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  max = 15,
  placeholder,
  prefix = "",
  "aria-label": ariaLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  max?: number;
  placeholder?: string;
  prefix?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const taken = new Set(value.map(slugify));
  const full = value.length >= max;

  function add(raw: string) {
    const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const item of items) {
      const key = slugify(item);
      if (!key || next.some((v) => slugify(v) === key) || next.length >= max) continue;
      // Reaproveita a grafia de uma sugestão existente ("FGTS" em vez de "fgts")
      next.push(suggestions.find((s) => slugify(s) === key) ?? item);
    }
    if (next.length !== value.length) onChange(next);
    setDraft("");
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 focus-within:outline-2 focus-within:outline-primary">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
          {prefix}
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="text-muted-foreground hover:text-foreground" aria-label={`Remover ${v}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        list={suggestions.length ? listId : undefined}
        disabled={full}
        aria-label={ariaLabel}
        placeholder={full ? `Máximo de ${max}` : value.length ? "" : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          const picked = (e.nativeEvent as InputEvent).inputType === "insertReplacementText" || (e.nativeEvent as InputEvent).inputType === undefined;
          if (v.includes(",") || (picked && suggestions.includes(v))) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        className={cn("min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground", full && "cursor-not-allowed")}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !taken.has(slugify(s))).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
