import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, asc, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, authors, blogs, categories, mcpLogs, posts, postTags, tags, topicQueue } from "@/db/schema";
import { POST_STATUSES, postInputSchema, savePost } from "../posts";
import { analyzeSeo } from "../seo/score";
import { saveImageFromUrl } from "../media";
import { blogBaseUrl } from "../tenant";
import { topPosts, viewsByDay } from "../stats";
import { slugify } from "../utils";

type ApiKey = typeof apiKeys.$inferSelect;
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const INSTRUCTIONS = `Servidor da rede de blogs. Fluxo diário recomendado para cada blog ativo:
1. list_blogs → escolha o blog.
2. get_blog_context(blogId) → leia o guia editorial, categorias e títulos recentes (não repita temas).
3. get_next_topic(blogId) → pegue a próxima pauta (fica "assigned").
4. search_posts(blogId, termo) → ache posts relacionados para 2–4 links internos (use o caminho "/slug").
5. Pesquise o tema em fontes confiáveis e escreva em Markdown (sem H1; comece com parágrafo que contém a palavra-chave; use H2/H3; 900–1800 palavras; frases curtas; FAQ de 3–5 perguntas; cite fontes).
6. Opcional: upload_image_from_url com imagem livre (Unsplash/Pexels) para capa.
7. analyze_seo para conferir; ajuste até score ≥ 80.
8. create_post com topicId, focusKeyword, seoTitle (≤60), metaDescription (120–160), categorySlug, tags, faq, sources. Sem publishAt o sistema agenda no próximo horário livre.
Nunca invente dados, preços, leis ou estatísticas: se não tiver fonte, não afirme. Escreva no idioma do blog.`;

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function shrinkArgs(args: unknown) {
  if (!args || typeof args !== "object") return args;
  const copy: Record<string, unknown> = { ...(args as Record<string, unknown>) };
  if (typeof copy.contentMd === "string" && copy.contentMd.length > 400) copy.contentMd = copy.contentMd.slice(0, 400) + `… (${copy.contentMd.length} chars)`;
  return copy;
}

export function createMcpServer(apiKey: ApiKey) {
  const server = new McpServer({ name: "rede-blogs", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  /** Registra a tool com log em mcp_logs e tratamento de erro. */
  function tool<S extends z.ZodRawShape>(name: string, description: string, shape: S, fn: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>) {
    server.registerTool(name, { description, inputSchema: shape }, (async (args: z.infer<z.ZodObject<S>>) => {
      const started = Date.now();
      try {
        const data = await fn(args);
        const res = ok(data);
        await db.insert(mcpLogs).values({ apiKeyId: apiKey.id, tool: name, args: shrinkArgs(args), ok: true, result: res.content[0].text.slice(0, 1000), durationMs: Date.now() - started });
        return res;
      } catch (e) {
        const msg = e instanceof z.ZodError ? `Dados inválidos: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` : e instanceof Error ? e.message : String(e);
        await db.insert(mcpLogs).values({ apiKeyId: apiKey.id, tool: name, args: shrinkArgs(args), ok: false, result: msg.slice(0, 1000), durationMs: Date.now() - started });
        return { isError: true, content: [{ type: "text", text: msg }] } satisfies ToolResult;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
  }

  tool("list_blogs", "Lista os blogs ativos com nicho, idioma, URL e ritmo de publicação.", {}, async () => {
    const list = await db.query.blogs.findMany({ where: eq(blogs.archived, false), orderBy: asc(blogs.id) });
    const counts = await db
      .select({ blogId: posts.blogId, status: posts.status, n: sql<number>`count(*)::int` })
      .from(posts)
      .groupBy(posts.blogId, posts.status);
    return Promise.all(
      list.map(async (b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        niche: b.niche,
        language: b.language,
        url: await blogBaseUrl(b),
        postsPerDay: b.postsPerDay,
        pendingTopics: (await db.$count(topicQueue, and(eq(topicQueue.blogId, b.id), eq(topicQueue.status, "idea")))),
        posts: Object.fromEntries(counts.filter((c) => c.blogId === b.id).map((c) => [c.status, c.n])),
      })),
    );
  });

  tool("get_blog_context", "Guia editorial, categorias, autores e últimos 30 títulos do blog (para manter tom e evitar repetição).", { blogId: z.number().int() }, async ({ blogId }) => {
    const blog = await db.query.blogs.findFirst({ where: eq(blogs.id, blogId) });
    if (!blog) throw new Error("Blog não encontrado");
    const [cats, auths, recent, scheduled] = await Promise.all([
      db.select({ slug: categories.slug, name: categories.name, description: categories.description }).from(categories).where(eq(categories.blogId, blogId)).orderBy(asc(categories.position)),
      db.select({ id: authors.id, name: authors.name, bio: authors.bio }).from(authors).where(eq(authors.blogId, blogId)),
      db.select({ title: posts.title, slug: posts.slug, focusKeyword: posts.focusKeyword }).from(posts).where(and(eq(posts.blogId, blogId), eq(posts.status, "published"))).orderBy(desc(posts.publishedAt)).limit(30),
      db.select({ title: posts.title, publishAt: posts.publishAt }).from(posts).where(and(eq(posts.blogId, blogId), eq(posts.status, "scheduled"))).orderBy(asc(posts.publishAt)),
    ]);
    return {
      blog: { id: blog.id, name: blog.name, tagline: blog.tagline, description: blog.description, niche: blog.niche, language: blog.language, url: await blogBaseUrl(blog) },
      editorialGuide: blog.editorialGuide,
      defaultStatusForAiPosts: blog.aiPostStatus,
      categories: cats,
      authors: auths,
      recentPublished: recent,
      scheduled,
    };
  });

  tool("get_next_topic", "Pega a próxima pauta (maior prioridade) e marca como 'assigned'. Pautas 'assigned' há mais de 24h voltam para a fila.", { blogId: z.number().int() }, async ({ blogId }) => {
    await db
      .update(topicQueue)
      .set({ status: "idea", assignedAt: null })
      .where(and(eq(topicQueue.blogId, blogId), eq(topicQueue.status, "assigned"), lt(topicQueue.assignedAt, new Date(Date.now() - 86400_000))));
    const topic = await db.query.topicQueue.findFirst({
      where: and(eq(topicQueue.blogId, blogId), eq(topicQueue.status, "idea")),
      orderBy: [desc(topicQueue.priority), asc(topicQueue.id)],
    });
    if (!topic) return { topic: null, message: "Fila vazia. Sugira novas pautas com add_topics." };
    await db.update(topicQueue).set({ status: "assigned", assignedAt: new Date() }).where(eq(topicQueue.id, topic.id));
    return { topic: { id: topic.id, keyword: topic.keyword, suggestedTitle: topic.title, intent: topic.intent, cluster: topic.cluster, notes: topic.notes } };
  });

  tool(
    "add_topics",
    "Adiciona pautas (keywords) à fila do blog. Duplicadas são ignoradas.",
    {
      blogId: z.number().int(),
      topics: z
        .array(z.object({ keyword: z.string().min(2), title: z.string().optional(), intent: z.string().optional(), cluster: z.string().optional(), priority: z.number().int().min(0).max(100).optional(), notes: z.string().optional() }))
        .min(1)
        .max(50),
    },
    async ({ blogId, topics }) => {
      const inserted = await db
        .insert(topicQueue)
        .values(topics.map((t) => ({ blogId, keyword: t.keyword.trim().toLowerCase(), title: t.title ?? "", intent: t.intent ?? "", cluster: t.cluster ?? "", priority: t.priority ?? 0, notes: t.notes ?? "" })))
        .onConflictDoNothing()
        .returning({ id: topicQueue.id, keyword: topicQueue.keyword });
      return { inserted: inserted.length, skipped: topics.length - inserted.length, topics: inserted };
    },
  );

  tool(
    "search_posts",
    "Busca posts do blog por título/palavra-chave. Use para checar duplicidade e achar links internos (link = '/' + slug).",
    { blogId: z.number().int(), query: z.string().default(""), status: z.enum(POST_STATUSES).optional(), limit: z.number().int().min(1).max(50).default(10) },
    async ({ blogId, query, status, limit }) => {
      const q = `%${query.trim()}%`;
      return db
        .select({ id: posts.id, title: posts.title, slug: posts.slug, status: posts.status, focusKeyword: posts.focusKeyword, seoScore: posts.seoScore, publishedAt: posts.publishedAt, publishAt: posts.publishAt })
        .from(posts)
        .where(and(eq(posts.blogId, blogId), status ? eq(posts.status, status) : undefined, query.trim() ? or(ilike(posts.title, q), ilike(posts.focusKeyword, q), ilike(posts.excerpt, q)) : undefined))
        .orderBy(desc(posts.updatedAt))
        .limit(limit);
    },
  );

  tool(
    "get_post",
    "Retorna um post completo (Markdown e campos SEO) para revisão ou atualização.",
    { postId: z.number().int() },
    async ({ postId }) => {
      const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), with: { category: true, postTags: { with: { tag: true } } } });
      if (!post) throw new Error("Post não encontrado");
      const { postTags: pt, category, ...rest } = post;
      return { ...rest, categorySlug: category?.slug ?? null, tags: pt.map((x) => x.tag.name) };
    },
  );

  // z.date não vira JSON Schema: no MCP a data chega como string ISO e o savePost converte
  const publishAt = z.string().describe("Data/hora ISO 8601 com fuso, ex.: 2026-10-20T08:00:00-03:00").nullish();
  const postShape = { ...postInputSchema.omit({ blogId: true, publishAt: true }).shape, publishAt };

  tool(
    "create_post",
    "Cria um post. Sem 'status' usa o padrão do blog para IA (scheduled ou review). Sem 'publishAt' agenda no próximo horário livre. Retorna score SEO e avisos.",
    { blogId: z.number().int(), ...postShape },
    async (args) => {
      const blog = await db.query.blogs.findFirst({ where: eq(blogs.id, args.blogId) });
      if (!blog) throw new Error("Blog não encontrado");
      const { post, seo, warnings, url } = await savePost({ ...args, status: args.status ?? blog.aiPostStatus }, { source: "mcp" });
      return { id: post.id, slug: post.slug, status: post.status, publishAt: post.publishAt, url, seoScore: seo.score, failedChecks: seo.checks.filter((c) => !c.ok).map((c) => `${c.label} — ${c.hint}`), warnings };
    },
  );

  tool(
    "update_post",
    "Atualiza campos de um post existente (só os enviados). Gera revisão no histórico.",
    { postId: z.number().int(), ...postInputSchema.omit({ blogId: true, publishAt: true }).partial().shape, publishAt },
    async ({ postId, ...patch }) => {
      const existing = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
      if (!existing) throw new Error("Post não encontrado");
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const { post, seo, warnings, url } = await savePost(
        {
          blogId: existing.blogId,
          title: existing.title,
          slug: existing.slug,
          contentMd: existing.contentMd,
          excerpt: existing.excerpt,
          seoTitle: existing.seoTitle,
          metaDescription: existing.metaDescription,
          focusKeyword: existing.focusKeyword,
          coverImage: existing.coverImage,
          coverAlt: existing.coverAlt,
          canonicalUrl: existing.canonicalUrl,
          ...clean,
        },
        { id: postId, source: "mcp" },
      );
      return { id: post.id, status: post.status, url, seoScore: seo.score, warnings };
    },
  );

  tool(
    "upload_image_from_url",
    "Baixa uma imagem (ex.: Unsplash/Pexels com licença livre), converte para WebP e retorna a URL para usar em coverImage ou no Markdown.",
    { url: z.string().url(), alt: z.string().min(5), blogId: z.number().int().optional() },
    async ({ url, alt, blogId }) => {
      const m = await saveImageFromUrl(url, { alt, blogId });
      return { url: m.url, width: m.width, height: m.height, alt: m.alt, markdown: `![${m.alt}](${m.url})` };
    },
  );

  tool(
    "analyze_seo",
    "Calcula o score SEO (0–100) de um rascunho sem salvar.",
    { title: z.string(), contentMd: z.string(), focusKeyword: z.string().optional(), seoTitle: z.string().optional(), metaDescription: z.string().optional(), slug: z.string().optional(), coverImage: z.string().optional(), faqCount: z.number().int().optional(), hasCategory: z.boolean().optional() },
    async (a) => {
      const r = analyzeSeo({ ...a, slug: a.slug ?? slugify(a.title) });
      return { score: r.score, wordCount: r.wordCount, checks: r.checks.map((c) => ({ ok: c.ok, partial: !!c.partial, label: c.label, hint: c.ok ? undefined : c.hint })) };
    },
  );

  tool(
    "get_seo_report",
    "Oportunidades de melhoria: posts publicados com score baixo, conteúdo curto ou desatualizado (180+ dias).",
    { blogId: z.number().int(), limit: z.number().int().min(1).max(50).default(15) },
    async ({ blogId, limit }) => {
      const base = and(eq(posts.blogId, blogId), eq(posts.status, "published"));
      const cols = { id: posts.id, title: posts.title, slug: posts.slug, seoScore: posts.seoScore, wordCount: posts.wordCount, updatedAt: posts.updatedAt };
      const [lowScore, short, stale] = await Promise.all([
        db.select(cols).from(posts).where(and(base, lt(posts.seoScore, 75))).orderBy(asc(posts.seoScore)).limit(limit),
        db.select(cols).from(posts).where(and(base, lt(posts.wordCount, 700))).orderBy(asc(posts.wordCount)).limit(limit),
        db.select(cols).from(posts).where(and(base, lt(posts.updatedAt, new Date(Date.now() - 180 * 86400_000)))).orderBy(asc(posts.updatedAt)).limit(limit),
      ]);
      const top = await topPosts(30, blogId, 10);
      return { lowScore, short, stale, topPosts30d: top, note: "Dados do Search Console (CTR/posição) entram quando a integração GSC estiver ativa." };
    },
  );

  tool(
    "get_analytics",
    "Visualizações por dia e posts mais lidos. Sem blogId = rede inteira.",
    { blogId: z.number().int().optional(), days: z.number().int().min(1).max(365).default(30) },
    async ({ blogId, days }) => {
      const series = await viewsByDay(days, blogId);
      const total = series.reduce((s, d) => s + d.views, 0);
      return { days, totalViews: total, series, topPosts: await topPosts(days, blogId, 10) };
    },
  );

  tool(
    "list_tags",
    "Lista as tags existentes do blog (reutilize em vez de criar variações).",
    { blogId: z.number().int() },
    async ({ blogId }) => {
      const rows = await db
        .select({ name: tags.name, slug: tags.slug, uses: sql<number>`count(${postTags.postId})::int` })
        .from(tags)
        .leftJoin(postTags, eq(postTags.tagId, tags.id))
        .where(eq(tags.blogId, blogId))
        .groupBy(tags.id)
        .orderBy(desc(sql`count(${postTags.postId})`));
      return rows;
    },
  );

  server.registerPrompt(
    "post_diario",
    { description: "Escreve e agenda o post do dia para um blog seguindo o guia editorial.", argsSchema: { blogId: z.string().describe("ID do blog") } },
    ({ blogId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Escreva o post de hoje para o blog ${blogId}. Siga exatamente o fluxo das instruções do servidor: get_blog_context, get_next_topic, search_posts para links internos, pesquisa com fontes, analyze_seo até score ≥ 80 e create_post com topicId. No final, me diga título, URL, data agendada e score.`,
          },
        },
      ],
    }),
  );

  return server;
}
