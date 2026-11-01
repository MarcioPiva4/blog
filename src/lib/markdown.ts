import "server-only";
import { Marked, type Tokens } from "marked";
import sanitizeHtml from "sanitize-html";
import { slugify } from "./utils";

export type TocItem = { id: string; text: string; level: 2 | 3 };

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "figure", "figcaption", "del", "ins", "mark"]),
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
    code: ["class"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
};

export function renderMarkdown(md: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  const marked = new Marked({ gfm: true });

  marked.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens);
        // H1 é o título do post; headings do corpo começam em H2
        const depth = Math.max(2, Math.min(token.depth, 6));
        const base = slugify(token.text) || "secao";
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        if (depth === 2 || depth === 3) toc.push({ id, text: token.text.replace(/[*_`]/g, ""), level: depth });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Link) {
        const inner = this.parser.parseInline(token.tokens);
        const external = /^https?:\/\//i.test(token.href);
        const title = token.title ? ` title="${escapeAttr(token.title)}"` : "";
        const ext = external ? ` target="_blank" rel="noopener"` : "";
        return `<a href="${escapeAttr(token.href)}"${title}${ext}>${inner}</a>`;
      },
      image(token: Tokens.Image) {
        const title = token.title ? ` title="${escapeAttr(token.title)}"` : "";
        return `<img src="${escapeAttr(token.href)}" alt="${escapeAttr(token.text)}"${title} loading="lazy" decoding="async">`;
      },
    },
  });

  const raw = marked.parse(md, { async: false }) as string;
  return { html: sanitizeHtml(raw, SANITIZE), toc };
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Divide o HTML em blocos para intercalar anúncios: primeiro corte após o parágrafo `after`,
 * depois a cada `every` parágrafos. Retorna os pedaços na ordem.
 */
export function splitForAds(html: string, after: number, every = 6): string[] {
  if (after <= 0) return [html];
  const chunks: string[] = [];
  let count = 0;
  let next = after;
  let last = 0;
  const re = /<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    count++;
    if (count === next) {
      const end = m.index + m[0].length;
      chunks.push(html.slice(last, end));
      last = end;
      next += every;
    }
  }
  chunks.push(html.slice(last));
  // Não termina com anúncio colado no fim do texto
  if (chunks.length > 1 && chunks[chunks.length - 1].replace(/<[^>]+>/g, "").trim().length < 200) {
    const tail = chunks.pop()!;
    chunks[chunks.length - 1] += tail;
  }
  return chunks;
}
