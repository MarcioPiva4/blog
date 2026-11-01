import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";

const TYPES: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif" };

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const root = path.resolve(config.mediaDir);
  const file = path.resolve(root, ...parts);
  if (!file.startsWith(root + path.sep)) return new Response(null, { status: 400 });
  try {
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        // Nomes têm sufixo aleatório: cache longo no Cloudflare e no navegador
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
