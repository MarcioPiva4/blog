import "server-only";
import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogs, categories, domains, type Blog } from "@/db/schema";
import { config, hostWithPort } from "./config";

export type Tenant = {
  blog: Blog;
  baseUrl: string;
  host: string;
  categories: (typeof categories.$inferSelect)[];
};

export type TenantResult = { kind: "ok"; tenant: Tenant } | { kind: "redirect"; to: string } | { kind: "missing" };

export function cleanHost(host: string) {
  return decodeURIComponent(host).toLowerCase().replace(/:\d+$/, "");
}

/** Host público canônico do blog: domínio primário, senão <slug>.<ROOT_DOMAIN>. */
export function canonicalHost(blog: Pick<Blog, "slug">, blogDomains: { hostname: string; isPrimary: boolean; redirectTo: string | null }[]) {
  const primary = blogDomains.find((d) => d.isPrimary && !d.redirectTo);
  return primary?.hostname ?? `${blog.slug}.${config.rootDomain}`;
}

export function baseUrlFor(host: string) {
  // Domínios próprios rodam sempre na porta padrão; só subdomínios de dev usam PUBLIC_PORT
  const isSub = host.endsWith(`.${config.rootDomain}`);
  return `${config.protocol}://${isSub ? hostWithPort(host) : host}`;
}

export async function blogBaseUrl(blog: Pick<Blog, "id" | "slug">) {
  const rows = await db.select().from(domains).where(eq(domains.blogId, blog.id));
  return baseUrlFor(canonicalHost(blog, rows));
}

/** Resolve o host (param [domain] da rota reescrita) para um blog. Dedup por request. */
export const resolveTenant = cache(async (rawHost: string): Promise<TenantResult> => {
  const host = cleanHost(rawHost);
  let blog: Blog | undefined;

  const domainRow = await db.query.domains.findFirst({ where: eq(domains.hostname, host) });
  if (domainRow) {
    if (domainRow.redirectTo) return { kind: "redirect", to: baseUrlFor(domainRow.redirectTo) };
    blog = await db.query.blogs.findFirst({ where: and(eq(blogs.id, domainRow.blogId), eq(blogs.archived, false)) });
  } else if (host.endsWith(`.${config.rootDomain}`)) {
    const slug = host.slice(0, -(config.rootDomain.length + 1));
    if (!slug.includes(".")) {
      blog = await db.query.blogs.findFirst({ where: and(eq(blogs.slug, slug), eq(blogs.archived, false)) });
    }
  }
  if (!blog) return { kind: "missing" };

  const blogDomains = await db.select().from(domains).where(eq(domains.blogId, blog.id));
  const canonical = canonicalHost(blog, blogDomains);
  // Subdomínio de um blog que já tem domínio próprio → 301 para o domínio próprio
  if (canonical !== host && !domainRow) return { kind: "redirect", to: baseUrlFor(canonical) };

  const cats = await db.select().from(categories).where(eq(categories.blogId, blog.id)).orderBy(asc(categories.position));
  return { kind: "ok", tenant: { blog, host, baseUrl: baseUrlFor(canonical), categories: cats } };
});
