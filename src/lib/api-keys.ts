import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Gera uma chave nova. O valor em claro só é mostrado uma vez. */
export async function createApiKey(name: string) {
  const key = `rbk_${randomBytes(24).toString("base64url")}`;
  const [row] = await db.insert(apiKeys).values({ name, prefix: key.slice(0, 10), keyHash: sha256(key) }).returning();
  return { key, row };
}

export async function verifyApiKey(key: string | null | undefined) {
  if (!key || !key.startsWith("rbk_")) return null;
  const row = await db.query.apiKeys.findFirst({ where: and(eq(apiKeys.keyHash, sha256(key)), isNull(apiKeys.revokedAt)) });
  if (!row) return null;
  // Atualiza "último uso" no máximo a cada minuto
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  }
  return row;
}
