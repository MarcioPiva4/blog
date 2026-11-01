"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Bloco AdSense responsivo com altura reservada (sem CLS). */
export function AdSlot({ pubId, label, slot }: { pubId: string; label: string; slot?: string }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (!ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);
  return (
    <aside className="my-8" aria-label={label}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="ad-slot">
        <ins
          ref={ref}
          className="adsbygoogle block w-full"
          data-ad-client={`ca-${pubId}`}
          {...(slot ? { "data-ad-slot": slot } : {})}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
