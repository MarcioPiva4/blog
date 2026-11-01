import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { resolveTenant, type Tenant } from "./tenant";

/** Para páginas públicas: resolve o tenant, aplica 301 de migração (mantendo o caminho) ou 404. */
export async function loadTenant(domain: string, path = ""): Promise<Tenant> {
  const res = await resolveTenant(domain);
  if (res.kind === "redirect") permanentRedirect(`${res.to}${path}`);
  if (res.kind === "missing") notFound();
  return res.tenant;
}

export const ISR_SECONDS = 3600;
