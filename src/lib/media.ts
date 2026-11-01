import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { db } from "@/db";
import { media } from "@/db/schema";
import { config } from "./config";
import { slugify } from "./utils";

const MAX_BYTES = 15 * 1024 * 1024;

/** Converte para WebP (máx. 1600px de largura), salva em MEDIA_DIR e registra no banco. */
export async function saveImage(buffer: Buffer, opts: { name: string; alt: string; blogId?: number | null }) {
  if (buffer.byteLength > MAX_BYTES) throw new Error("Imagem maior que 15 MB");
  const image = sharp(buffer, { failOn: "error" }).rotate();
  const out = await image.resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });

  const now = new Date();
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const file = `${slugify(opts.name).slice(0, 60) || "imagem"}-${randomBytes(3).toString("hex")}.webp`;
  const rel = `${dir}/${file}`;
  await mkdir(path.join(config.mediaDir, dir), { recursive: true });
  await writeFile(path.join(config.mediaDir, rel), out.data);

  const [row] = await db
    .insert(media)
    .values({
      blogId: opts.blogId ?? null,
      path: rel,
      url: `/api/media/${rel}`,
      alt: opts.alt,
      width: out.info.width,
      height: out.info.height,
      mime: "image/webp",
      size: out.info.size,
    })
    .returning();
  return row;
}

function isPrivateHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(hostname) ||
    hostname.startsWith("[")
  );
}

export async function saveImageFromUrl(url: string, opts: { alt: string; blogId?: number | null; name?: string }) {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("URL precisa ser http(s)");
  if (isPrivateHost(u.hostname)) throw new Error("Host não permitido");
  const res = await fetch(u, { signal: AbortSignal.timeout(15000), redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status})`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`Conteúdo não é imagem (${type})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return saveImage(buf, { name: opts.name ?? opts.alt, alt: opts.alt, blogId: opts.blogId });
}
