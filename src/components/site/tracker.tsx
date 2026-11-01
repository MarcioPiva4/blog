"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Beacon de pageview a cada navegação (inclusive client-side). Sem cookies. */
export function Tracker({ blogId }: { blogId: number }) {
  const pathname = usePathname();
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-post-id]");
    const body = JSON.stringify({
      b: blogId,
      p: el ? Number(el.dataset.postId) : null,
      path: location.pathname,
      r: document.referrer,
    });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "text/plain" }));
      else fetch("/api/track", { method: "POST", body, keepalive: true });
    } catch {}
  }, [blogId, pathname]);
  return null;
}
