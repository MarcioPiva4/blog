# Rede de Blogs

Painel para criar e operar vários blogs de nicho com SEO automático, estatísticas próprias, anúncios e um servidor **MCP** para a IA (Claude Cowork) escrever e agendar posts. Plano completo em [plan.md](plan.md); blogs iniciais em [blogs.md](blogs.md).

Stack: Next.js 16 · Postgres 17 · Drizzle · Tailwind v4 · MCP SDK. Tudo gratuito/self-hosted.

## Rodar localmente

```bash
npm install
cp .env.example .env              # preencha os segredos (próximo passo)
npm run hash-password -- "sua-senha"   # imprime ADMIN_PASSWORD_HASH, AUTH_SECRET, CRON_SECRET, INDEXNOW_KEY
npm run db:up                     # Postgres no Docker (porta 5434)
npm run db:migrate                # cria as tabelas
npm run db:seed                   # cria os 5 blogs + 60 pautas do blogs.md
npm run dev                       # http://localhost:3100
```

- Painel: <http://painel.localhost:3100> (login = `ADMIN_EMAIL` + senha)
- Blogs: <http://bolsoemdia.localhost:3100>, `cliquecerto`, `larpratico`, `stackwise`, `leafycorner`

`*.localhost` resolve sozinho no Chrome/Edge.

## Como funciona

| Peça | Onde |
|---|---|
| Multi-tenant: host → blog (rewrite para `/sites/<host>`) | `src/proxy.ts`, `src/lib/tenant.ts` |
| Schema do banco | `src/db/schema.ts` |
| Salvar post (validação, slug, score SEO, agendamento, revisões, IndexNow) | `src/lib/posts.ts` |
| Score SEO 0–100 (editor, MCP e API usam o mesmo) | `src/lib/seo/score.ts` |
| Servidor MCP (13 tools + prompt `post_diario`) | `src/lib/mcp/server.ts`, `src/app/api/mcp/` |
| Páginas públicas (ISR 1h, JSON-LD, sitemap, RSS, robots, ads.txt, OG) | `src/app/sites/[domain]/` |
| Painel | `src/app/(admin)/dashboard/` |
| Estatísticas sem cookies | `src/app/api/track`, `src/lib/stats.ts` |
| Cron (publicar agendados, consolidar stats) | `src/app/api/cron/[job]` |

## Deploy grátis (Oracle Cloud + Coolify + Cloudflare)

1. **Domínio**: peça `seunome.eu.org` em nic.eu.org (demora) e delegue os nameservers para o **Cloudflare** (plano Free).
2. **VM**: Oracle Cloud Always Free → Ampere A1 (4 OCPU / 24 GB), Ubuntu. Libere portas 80/443 na Security List e no firewall. Converta a conta para Pay As You Go (continua R$ 0) e crie alerta de orçamento de R$ 0,01.
3. **Coolify**: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash` na VM.
4. No Coolify:
   - Crie um **PostgreSQL 17** e copie a URL interna para `DATABASE_URL`.
   - Crie a aplicação a partir do repositório GitHub, build pack **Dockerfile**, porta 3000.
   - Volume persistente: `/data/media` (e `MEDIA_DIR=/data/media`).
   - Variáveis: as do `.env.example` com `ROOT_DOMAIN=seunome.eu.org`, `ADMIN_HOST=painel.seunome.eu.org`, `PUBLIC_PROTOCOL=https`, `PUBLIC_PORT=` vazio.
   - Domínios da aplicação: `https://painel.seunome.eu.org` e `https://*.seunome.eu.org` (+ domínios próprios dos blogs, quando houver).
   - As migrações rodam sozinhas no boot (`src/instrumentation.ts`). Para o seed, abra um túnel SSH até o Postgres da VM e rode `npm run db:seed` na sua máquina com `DATABASE_URL` apontando para o túnel (ou crie os blogs pelo painel).
5. **Cloudflare DNS**: registros `A` para `painel`, `*` (wildcard) apontando para o IP da VM, proxy ligado. SSL/TLS em **Full (strict)** com Origin Certificate no Coolify.
6. **Scheduled Tasks** no Coolify (comando dentro do container):
   - a cada 10 min: `wget -qO- --header="Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/publish`
   - a cada hora: `wget -qO- --header="Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/aggregate`
7. **Backup**: Scheduled Task diária com `pg_dump` + `rclone copy` para o Google Drive (15 GB grátis).

## Conectar a IA (Cowork)

1. Painel → **Integração IA (MCP)** → *Criar chave*. Copie a **URL secreta** (`https://painel.seunome.eu.org/api/mcp/rbk_…`).
2. Claude → Configurações → Conectores → **Adicionar conector personalizado** → cole a URL.
3. No Cowork, crie uma **tarefa agendada diária**: “Para cada blog de `list_blogs`, use o prompt `post_diario`”.
4. Acompanhe as chamadas no log do painel. Blogs com `IA: revisão` (Bolso em Dia e Stackwise, por serem temas sensíveis) deixam os posts esperando sua aprovação em **Posts → Revisão**.

Trate a URL secreta como senha: quem tiver ela pode publicar. Revogue no painel se vazar.

## Antes de ligar anúncios

- Revise as páginas institucionais (Sobre, Contato, Privacidade, Termos — geradas por `src/lib/institutional.ts`) e preencha o e-mail de contato de cada blog.
- Tenha ~30 posts de qualidade por blog, então peça o AdSense e preencha o `pub-…` no blog (gera `ads.txt`); ligue “Exibir anúncios” só depois da aprovação.
