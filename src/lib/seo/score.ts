import { countWords, firstParagraph, markdownToPlain } from "../text";
import { normalize, slugify } from "../utils";

export type SeoInput = {
  title: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  slug: string;
  focusKeyword?: string | null;
  contentMd: string;
  coverImage?: string | null;
  faqCount?: number;
  /** Omitido = critério de categoria fica de fora (ex.: análise avulsa via MCP). */
  hasCategory?: boolean;
};

export type SeoCheck = { id: string; label: string; ok: boolean; partial?: boolean; weight: number; hint: string };
export type SeoResult = { score: number; checks: SeoCheck[]; wordCount: number };

/** Score SEO 0–100. Função pura: roda no editor (client), na API e no MCP. */
export function analyzeSeo(input: SeoInput): SeoResult {
  const kw = normalize(input.focusKeyword ?? "");
  const title = input.seoTitle?.trim() || input.title.trim();
  const meta = (input.metaDescription ?? "").trim();
  const md = input.contentMd ?? "";
  const plain = normalize(markdownToPlain(md));
  const words = countWords(md);

  const headings = [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: normalize(m[2]) }));
  const h2Count = headings.filter((h) => h.level === 2).length;
  const links = [...md.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map((m) => m[1]);
  const internal = links.filter((l) => l.startsWith("/") || !/^https?:/i.test(l)).length;
  const external = links.length - internal;
  const images = [...md.matchAll(/!\[([^\]]*)\]\([^)]*\)/g)];
  const imagesWithoutAlt = images.filter((m) => !m[1].trim()).length;

  const kwOccurrences = kw ? plain.split(kw).length - 1 : 0;
  const density = kw && words ? ((kwOccurrences * kw.split(" ").length) / words) * 100 : 0;

  const sentences = markdownToPlain(md).split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
  const avgSentence = sentences.length ? words / sentences.length : 0;

  const has = (text: string) => !!kw && normalize(text).includes(kw);
  const kwSlug = kw ? slugify(kw) : "";

  const checks: SeoCheck[] = [
    { id: "kw", label: "Palavra-chave foco definida", ok: !!kw, weight: 10, hint: "Defina a palavra-chave principal do post." },
    { id: "kw-title", label: "Palavra-chave no título", ok: has(title), weight: 10, hint: "Inclua a palavra-chave no título (de preferência no início)." },
    {
      id: "title-len",
      label: `Título SEO com 30–60 caracteres (${title.length})`,
      ok: title.length >= 30 && title.length <= 60,
      weight: 8,
      hint: "Títulos longos são cortados no Google; curtos demais perdem cliques.",
    },
    {
      id: "meta-len",
      label: `Meta description com 120–160 caracteres (${meta.length})`,
      ok: meta.length >= 120 && meta.length <= 160,
      partial: meta.length >= 70 && meta.length < 120,
      weight: 8,
      hint: "Escreva um resumo atrativo que convide ao clique.",
    },
    { id: "kw-meta", label: "Palavra-chave na meta description", ok: has(meta), weight: 6, hint: "Use a palavra-chave na meta description." },
    {
      id: "kw-slug",
      label: "Palavra-chave na URL (slug)",
      ok: !!kwSlug && (input.slug.includes(kwSlug) || kwSlug.split("-").every((w) => input.slug.includes(w))),
      weight: 6,
      hint: "Slug curto contendo a palavra-chave.",
    },
    { id: "kw-intro", label: "Palavra-chave no primeiro parágrafo", ok: has(firstParagraph(md)), weight: 8, hint: "Cite a palavra-chave logo no começo do texto." },
    { id: "kw-heading", label: "Palavra-chave em algum H2/H3", ok: !!kw && headings.some((h) => h.text.includes(kw)), weight: 6, hint: "Use a palavra-chave (ou variação) em um subtítulo." },
    {
      id: "length",
      label: `Conteúdo com 800+ palavras (${words})`,
      ok: words >= 800,
      partial: words >= 500 && words < 800,
      weight: 10,
      hint: "Conteúdo completo tende a ranquear melhor. Responda a intenção de busca por inteiro.",
    },
    { id: "h2", label: `3+ subtítulos H2 (${h2Count})`, ok: h2Count >= 3, partial: h2Count >= 1 && h2Count < 3, weight: 6, hint: "Divida o texto em seções com H2." },
    { id: "internal", label: `2+ links internos (${internal})`, ok: internal >= 2, partial: internal === 1, weight: 6, hint: "Linke outros posts do mesmo blog (ex.: /outro-post)." },
    { id: "external", label: `1+ link externo de referência (${external})`, ok: external >= 1, weight: 4, hint: "Cite uma fonte confiável (site oficial, estudo)." },
    {
      id: "images",
      label: "Imagem de capa e imagens com alt",
      ok: !!input.coverImage && imagesWithoutAlt === 0,
      partial: !input.coverImage && images.length > 0 && imagesWithoutAlt === 0,
      weight: 4,
      hint: "Adicione imagem de capa e texto alternativo em todas as imagens.",
    },
    {
      id: "density",
      label: `Densidade da palavra-chave 0,5–2,5% (${density.toFixed(1)}%)`,
      ok: density >= 0.5 && density <= 2.5,
      partial: density > 0 && density < 0.5,
      weight: 6,
      hint: density > 2.5 ? "Palavra-chave repetida demais (keyword stuffing)." : "Use a palavra-chave e variações ao longo do texto.",
    },
    {
      id: "readability",
      label: `Frases curtas (média ${avgSentence.toFixed(0)} palavras)`,
      ok: avgSentence > 0 && avgSentence <= 22,
      partial: avgSentence > 22 && avgSentence <= 28,
      weight: 4,
      hint: "Prefira frases com até ~20 palavras.",
    },
    { id: "faq", label: "FAQ com 3+ perguntas", ok: (input.faqCount ?? 0) >= 3, partial: (input.faqCount ?? 0) > 0, weight: 4, hint: "FAQ ajuda em rich results e buscas por voz/IA." },
  ];
  if (input.hasCategory !== undefined) {
    checks.push({
      id: "category",
      label: "Post em uma categoria",
      ok: input.hasCategory,
      weight: 4,
      hint: "A categoria entra no breadcrumb e agrupa posts relacionados (links internos).",
    });
  }

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.ok ? c.weight : c.partial ? c.weight / 2 : 0), 0);
  return { score: Math.round((earned / total) * 100), checks, wordCount: words };
}
