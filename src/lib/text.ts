/** Funções puras sobre Markdown — usadas no servidor e no editor (client). */

export function markdownToPlain(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*[#>|-]+/gm, " ")
    .replace(/[*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(md: string) {
  const plain = markdownToPlain(md);
  return plain ? plain.split(" ").length : 0;
}

export function readingTime(words: number) {
  return Math.max(1, Math.round(words / 220));
}

/** Primeiro parágrafo de texto (ignora headings, imagens, listas). */
export function firstParagraph(md: string) {
  const blocks = md.split(/\n\s*\n/);
  for (const b of blocks) {
    const s = b.trim();
    if (!s || /^(#|!\[|[-*+]\s|\d+\.\s|>|\||```)/.test(s)) continue;
    return markdownToPlain(s);
  }
  return "";
}

export function makeExcerpt(md: string, max = 160) {
  const p = firstParagraph(md) || markdownToPlain(md);
  return p.length > max ? p.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : p;
}
