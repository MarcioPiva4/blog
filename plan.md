# Plano — Rede de Blogs Multi-tenant com SEO, MCP e Monetização (100% grátis)

## Contexto

Plataforma própria (usuário único = dono) para criar e operar **vários blogs de nicho** a partir de **um painel**. Cada blog tem domínio/subdomínio próprio, posts otimizados para SEO, estatísticas e anúncios. Uma IA (Claude Cowork) escreve e agenda posts diariamente via **MCP**. Objetivo de negócio: **receita por visualização (RPM) via anúncios + afiliados**.

Restrições definidas: Next.js + Postgres, **custo zero** em todas as ferramentas, rede própria (sem outros autores), hospedagem **Oracle Cloud Always Free**.

---

## 1. Stack (tudo gratuito / open source)

| Camada | Escolha | Custo |
|---|---|---|
| Servidor | **Oracle Cloud Always Free** — VM Ampere A1 (até 4 vCPU ARM, 24 GB RAM, 200 GB disco) | R$ 0 |
| Deploy/PaaS | **Coolify** (self-hosted) — deploy por push no GitHub, SSL, cron, backups | R$ 0 |
| CDN/DNS/SSL | **Cloudflare Free** — DNS, cache, proxy, Origin Certificate, proteção DDoS | R$ 0 |
| Framework | Next.js 16 (App Router, TS, Server Actions), `output: 'standalone'` em Docker | R$ 0 |
| Banco | **Postgres 17** em container no próprio VPS | R$ 0 |
| ORM | Drizzle + drizzle-kit | R$ 0 |
| Auth (painel) | Auth.js (login GitHub restrito ao seu e-mail) | R$ 0 |
| UI | Tailwind v4 + shadcn/ui + lucide | R$ 0 |
| Gráficos | Recharts (shadcn charts) | R$ 0 |
| Editor | Markdown armazenado + Tiptap (core open source) no painel | R$ 0 |
| Imagens | Disco do VPS (`/data/media`) + `sharp` p/ WebP/AVIF, servido com cache do Cloudflare | R$ 0 |
| MCP | `mcp-handler` / `@modelcontextprotocol/sdk` em `app/api/mcp/[transport]` | R$ 0 |
| Cron | Scheduled Tasks do Coolify (chama `/api/cron/*` com `CRON_SECRET`) | R$ 0 |
| Backup | `pg_dump` diário + **rclone** → Google Drive (15 GB grátis) | R$ 0 |
| SEO/receita | Google Search Console API, AdSense Management API, IndexNow | R$ 0 |

Observação: o **Claude Cowork** depende do seu plano Claude (que você já usa) — não é custo novo do projeto.

### Cuidados com a Oracle Free
- Escolha a **home region** com cuidado (não muda depois); São Paulo às vezes fica sem capacidade ARM — tentar novamente ou usar Vinhedo.
- Instâncias Always Free ociosas podem ser recuperadas pela Oracle. Mitigação: converter a conta para **Pay As You Go** (continua R$ 0 dentro dos limites free; pede cartão só para verificação) e configurar **alerta de orçamento em R$ 0,01**.
- Liberar portas 80/443 na Security List + firewall do Ubuntu; aceitar tráfego só dos IPs do Cloudflare.

## 2. Domínio grátis — opções e estratégia

O AdSense **não aceita subdomínios de plataformas** (`*.vercel.app`, `*.pages.dev`), mas aceita domínio que você controla. Opções sem custo:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **`seunome.eu.org`** (recomendado) | Pedido grátis em nic.eu.org, delega NS para o Cloudflare | Registro sério desde 1996, permanente, wildcard funciona | Aprovação manual demora (dias a semanas) |
| **DigitalPlat FreeDomain** (`.dpdns.org`, `.us.kg`, `.qzz.io`) | Cadastro no site, delega NS p/ Cloudflare | Rápido | Reputação de spam em alguns TLDs, aceitação no AdSense incerta |
| GitHub Student Pack | Domínio `.me`/`.tech` grátis por 1 ano | TLD normal | Só se for estudante; paga a renovação |
| Sem domínio (IP / `sslip.io`) | — | Imediato | Sem AdSense, sem SEO sério — só para desenvolvimento |

**Estratégia**:
1. Pedir `eu.org` **no dia 1** (por causa da demora) e, enquanto isso, desenvolver com DigitalPlat ou `sslip.io`.
2. Todos os blogs como subdomínios wildcard: `receitas.seunome.eu.org`, `financas.seunome.eu.org`.
3. O sistema trata domínio como dado (tabela `domains`): quando um blog der receita, você compra um domínio próprio para ele e o painel faz **301 do antigo para o novo** + canonical — migração sem perder a maior parte do SEO.
4. Monetizar primeiro com **afiliados** (não exigem domínio próprio) e pedir AdSense quando o blog tiver ~30 posts.

Risco honesto: domínios grátis têm menos confiança de anunciantes e podem ser revogados; por isso o passo 3 existe desde o início.

## 3. Arquitetura multi-tenant

```
Cloudflare (DNS *.seunome.eu.org + domínios próprios, cache)
   └─> Oracle VM ─ Coolify (Traefik + SSL Origin Cert)
         ├─ container next-app (standalone)
         ├─ container postgres
         └─ volume /data/media

request (host) ──> proxy.ts
   ├─ painel.seunome.eu.org   → /(admin)/...                 (auth obrigatória)
   ├─ /api/mcp                → servidor MCP                  (Bearer API key)
   └─ qualquer outro host     → rewrite /_sites/[host]/...    (blog público)
```

- `proxy.ts` resolve `host` → blog (cache em memória com TTL), reescreve a rota.
- Páginas públicas com **ISR** (`revalidate`) + `revalidateTag('blog:<id>')` ao publicar/editar; Cloudflare cacheia HTML com `s-maxage` → VPS aguenta muito tráfego.
- Novo domínio próprio: adiciona no painel → instrução de DNS (CNAME/A para o IP) → aparece verificado.

Estrutura de pastas:
```
src/
  app/
    (admin)/dashboard/...          painel
    _sites/[domain]/               blog público (home, [slug], categoria/[slug], tag, autor, busca)
    _sites/[domain]/sitemap.ts | robots.ts | feed.xml | ads.txt | llms.txt
    api/mcp/[transport]/route.ts   MCP
    api/track/route.ts             beacon de pageview
    api/media/[...path]/route.ts   serve imagens do disco
    api/cron/*                     publish | aggregate | gsc-sync | adsense-sync | backup
  db/schema.ts, db/index.ts
  lib/seo/ (score, jsonld, metadata), lib/tenant.ts, lib/markdown.ts, lib/ads/
  components/blog-themes/{magazine,minimal,editorial}/
  components/admin/
Dockerfile, docker-compose.yml (dev local)
```

## 4. Modelo de dados (Drizzle / Postgres)

- **blogs**: id, name, slug, niche, language, description, editorial_guide (tom de voz p/ IA), theme, brand_color, logo, favicon, default_author_id, adsense_pub_id, ads_enabled, ai_post_status (`scheduled|review`), posts_per_day, settings(jsonb)
- **domains**: id, blog_id, hostname, is_primary, verified, redirect_to (301 em migração)
- **authors** (personas por blog p/ E-E-A-T): name, slug, bio, avatar, expertise, social links
- **categories**, **tags**, **post_tags**
- **posts**: id, blog_id, author_id, category_id, title, slug, excerpt, content_md, cover_image, status (`draft|review|scheduled|published|archived`), publish_at, published_at, updated_at, seo_title, meta_description, focus_keyword, secondary_keywords[], canonical_url, noindex, faq(jsonb), affiliate_products(jsonb), seo_score, word_count, reading_time, source (`manual|mcp`)
- **post_revisions** (histórico; reverter edições da IA)
- **media**: path, alt, width, height, blog_id
- **topic_queue**: blog_id, keyword, intent, cluster, priority, status (`idea|assigned|written|published`), post_id — pauta que a IA consome
- **ad_slots**: blog_id, position (`header|in_content|sidebar|end_post|sticky_mobile`), network, ad_code/unit_id, after_paragraph, enabled
- **page_views** (bruto, 90 dias): blog_id, post_id, path, referrer_host, country (header `CF-IPCountry`), device, utm, session_hash, created_at — sem IP/cookies (LGPD)
- **daily_stats**: blog_id, post_id, date, views, uniques, avg_time, top_referrers(jsonb)
- **gsc_stats**: blog_id, page, query, date, clicks, impressions, ctr, position
- **revenue_daily**: blog_id, date, source (`adsense|ezoic|afiliado`), page_views, impressions, clicks, earnings, rpm
- **api_keys** (hash), **mcp_logs** (tool, args, result, ts)

## 5. Funcionalidades

### 5.1 Painel (admin)
- **Visão geral da rede**: views, receita, RPM, posts publicados, crescimento por blog.
- **Blogs**: criar (nome, nicho, idioma, tema, cor, guia editorial, domínio), editar, arquivar.
- **Posts**: lista com filtros, editor com **painel SEO lateral** (score ao vivo), preview, agendar, revisões, fila “Revisão” para posts vindos da IA.
- **Calendário editorial** por blog.
- **Pauta / Keywords** por cluster (a IA consome e sugere).
- **Mídia**: upload, conversão WebP, alt obrigatório.
- **Monetização**: redes por blog, slots, ads.txt, afiliados, receita/RPM por blog e por post.
- **Estatísticas**: tráfego próprio, Search Console, Core Web Vitals.
- **MCP**: gerar/revogar API key, logs das chamadas.
- **Domínios**: adicionar, verificar, migrar com 301.

### 5.2 SEO automatizado (por blog)
- Metadata API: title template, description, canonical, OpenGraph/Twitter, `hreflang` se multilíngue.
- **JSON-LD**: `BlogPosting`, `BreadcrumbList`, `Organization`, `Person`, `FAQPage`, `WebSite` + SearchAction.
- `sitemap.xml` dinâmico por tenant, `robots.txt`, RSS, `llms.txt`.
- **OG image** automática via `next/og`.
- **Score SEO** (0–100): keyword no título/H1/primeiro parágrafo/slug/meta, title ≤60, meta 120–155, hierarquia H2/H3, nº de palavras, links internos/externos, alt em imagens, legibilidade, duplicidade.
- **Links internos automáticos** para posts do mesmo cluster.
- **Indexação**: IndexNow ao publicar; sitemap enviado ao Search Console via API.
- Performance: ISR + cache Cloudflare, `next/image`, `next/font`, mínimo JS no blog, espaço reservado para anúncios (CLS ≈ 0).
- Páginas de autor/categoria/tag com conteúdo próprio; páginas institucionais por blog (Sobre, Contato, Privacidade, Termos) — **exigidas pelo AdSense**.

### 5.3 MCP (para Claude Cowork)
Servidor remoto em `https://painel.seunome.eu.org/api/mcp/mcp`, auth `Authorization: Bearer <api_key>`. No Cowork: adicionar como conector custom + **tarefa agendada diária** (“para cada blog ativo, pegue o próximo tópico da pauta, pesquise, escreva e agende”).

| Tool | Função |
|---|---|
| `list_blogs` | blogs, nicho, idioma, guia editorial, posts/dia |
| `get_blog_context` | personas, categorias, últimos 30 títulos (evita repetição) |
| `get_next_topic` | próximo item da pauta (marca `assigned`) |
| `add_topics` | IA sugere novas keywords para a pauta |
| `search_posts` | checar duplicidade + achar links internos |
| `create_post` | Markdown + campos SEO + FAQ + categoria/tags + `publish_at` → retorna score e avisos |
| `update_post` | edita post (gera revisão) |
| `upload_image_from_url` | baixa imagem (ex.: Unsplash/Pexels, grátis) p/ o disco |
| `analyze_seo` | score + checklist antes de salvar |
| `get_seo_report` | oportunidades: CTR baixo, posição 8–20, posts a atualizar |
| `get_analytics` | views/receita por blog/post/período |

Regras: rate limit por chave, validação Zod, slug único, mínimo de palavras/score, status inicial configurável por blog (`scheduled` ou `review`), log de toda chamada.

> **Risco de SEO**: Google penaliza “conteúdo em escala de baixo valor”. Mitigação: gates de qualidade, personas com bio, FAQ e dados úteis, ritmo gradual (1 post/dia/blog no início), atualização de posts antigos via `get_seo_report`, revisão opcional.

### 5.4 Estatísticas próprias
- Script <1 KB com `navigator.sendBeacon` → `/api/track` (filtra bots, sem cookies, hash diário anônimo).
- Cron diário agrega → `daily_stats` e apaga bruto > 90 dias.
- Cron diário: Search Console API → `gsc_stats`; AdSense Management API → `revenue_daily`.
- Métricas: views, únicos, RPM (receita / views × 1000), receita por post, top queries, posição média, CTR.

## 6. Monetização

**Modelo**: receita por mil visualizações (RPM). Mais views × melhor RPM = mais receita. Todas as redes abaixo são gratuitas (ficam com % da receita).

Escada por blog:
1. **Afiliados desde o dia 1** (sem exigência de domínio/tráfego): Amazon Associados, Mercado Livre, Hotmart, Shopee — bloco “produtos recomendados” por post (`affiliate_products`).
2. **Google AdSense** — quando houver domínio aceito, páginas institucionais e ~30 posts.
3. **Ezoic** — sem mínimo de tráfego, alternativa se AdSense recusar.
4. **Mediavine Journey** (~10k sessões/mês) → **Mediavine/Raptive** (50k–100k) — RPM bem maior (tráfego EUA/inglês). Nesse ponto, comprar domínio próprio para o blog (pago pela receita).

Implementação:
- `ads.txt` dinâmico por domínio.
- `<AdSlot position>` com altura reservada, lazy-load abaixo da dobra, desligável por blog/post.
- Inserção automática **in-content** após parágrafo N no render do Markdown.
- Consentimento: banner LGPD + Google CMP (grátis no AdSense) para tráfego UE/UK.
- Relatórios de RPM por blog/post/categoria → decide quais nichos escalar.

Alavancas: nichos de CPC alto (finanças, saúde, tecnologia, seguros), conteúdo em inglês (CPM maior), posts longos (3–5 anúncios), tempo de leitura.

## 7. Design

### Painel (admin)
- Sidebar fixa (Visão geral, Blogs, Posts, Calendário, Pauta, Mídia, Estatísticas, Monetização, MCP, Config) + seletor de blog no topo.
- shadcn/ui, base **zinc**, acento **indigo-600**, claro/escuro, **Inter** (UI) + **JetBrains Mono** (IDs/código).
- KPIs com sparkline, tabelas densas com filtros, editor em 2 colunas (texto | score SEO circular + checklist), calendário com chips na cor do blog.

### Blogs públicos — 3 temas (por blog, cor de marca customizável)
- **Magazine**: destaque + grid de cards + sidebar (anúncio e populares).
- **Minimal**: coluna única, foco em leitura, anúncios in-content — melhor RPM por tempo de leitura.
- **Editorial**: serifada, capa grande, estilo revista.
- Leitura: **Source Serif 4** (corpo 18–20px, linha 1.7, ~68ch) + **Inter** (títulos/UI) — Google Fonts, grátis.
- Tokens CSS por blog: `--brand`, `--brand-foreground`, `--radius`, fonte; claro/escuro.
- Post: breadcrumb, H1, autor + data + tempo de leitura, capa, sumário automático, anúncios intercalados, produtos afiliados, FAQ, box do autor, relacionados, CTA.
- Mobile-first; meta Lighthouse ≥ 95.

## 8. Roadmap

| Fase | Entrega | Est. |
|---|---|---|
| 0 | Pedir domínio eu.org; criar VM Oracle + Coolify + Cloudflare; projeto Next.js, Drizzle, Postgres, Auth.js, shadcn, Dockerfile, deploy | 2–3 dias |
| 1 | Multi-tenant (proxy.ts) + CRUD blogs/domínios + tema Minimal | 3–4 dias |
| 2 | Posts: editor, categorias/tags, autores, mídia, agendamento + cron | 4–5 dias |
| 3 | SEO: metadata, JSON-LD, sitemap/robots/RSS, OG, score, links internos, IndexNow | 3–4 dias |
| 4 | **MCP** + API keys + logs + pauta; tarefa diária no Cowork | 3 dias |
| 5 | Estatísticas: tracker, agregação, dashboard, Search Console | 3–4 dias |
| 6 | Monetização: afiliados, ads.txt, AdSlot, in-content, consentimento, AdSense API, RPM | 3 dias |
| 7 | Temas Magazine/Editorial, páginas institucionais, migração de domínio 301, backups, polish | 3 dias |

MVP (IA publicando diariamente) = fases 0–4.

## 9. Variáveis de ambiente
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID/SECRET`, `ADMIN_EMAIL`, `ROOT_DOMAIN`, `ADMIN_HOST`, `MEDIA_DIR`, `CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON` (GSC), `ADSENSE_OAUTH_*`, `INDEXNOW_KEY`.

## 10. Verificação
- Local: `docker compose up` (Postgres) + `npm run dev`; `blog1.localhost:3000` e `blog2.localhost:3000` mostram blogs distintos.
- `npm run build` + `drizzle-kit migrate` sem erros; deploy no Coolify a partir do GitHub.
- MCP: **MCP Inspector** (`npx @modelcontextprotocol/inspector`) → `list_blogs`, `create_post` agendado → cron publica → post no blog, no sitemap, JSON-LD válido (Rich Results Test).
- SEO: Lighthouse ≥ 95; `robots.txt`, `sitemap.xml`, `ads.txt` por domínio.
- Stats: visitar post → `page_views` → após cron, `daily_stats` e dashboard.
- Backup: rodar cron de backup e restaurar dump em banco de teste.
- Cowork: conector adicionado, tarefa diária cria 1 post/blog.

## Próximo passo
Fase 0: pedir o domínio `eu.org`, criar a VM na Oracle, instalar Coolify e configurar Cloudflare; em paralelo, criar o projeto Next.js localmente.
