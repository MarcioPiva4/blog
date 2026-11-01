import type { BlogLanguage, BlogTheme } from "./schema";

/** Os 5 blogs iniciais definidos em blogs.md. */
export type SeedBlog = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  niche: string;
  language: BlogLanguage;
  theme: BlogTheme;
  brandColor: string;
  aiPostStatus: "scheduled" | "review";
  affiliateDisclosure: string;
  editorialGuide: string;
  categories: string[];
  topics: [keyword: string, title: string, intent: string, cluster: string][];
};

const PT_RULES = `
Regras gerais (todos os posts):
- Escreva em português do Brasil, frases curtas, voz ativa, segunda pessoa ("você").
- Comece com um parágrafo de 2–3 frases que responde a dúvida e contém a palavra-chave.
- Logo depois, um bloco "**Resumo rápido:**" com 3–5 bullets.
- Use H2/H3 descritivos; inclua passo a passo numerado quando houver procedimento.
- 900–1800 palavras. Termine com FAQ (3–5 perguntas reais de quem busca o tema).
- 2–4 links internos para posts do mesmo blog (caminho "/slug") e 1–3 links para fontes confiáveis.
- Nunca invente números, datas, regras, preços ou estatísticas. Sem fonte, não afirme.
- Não use H1 no corpo (o título já é o H1). Não use emojis.`;

const EN_RULES = `
General rules (every post):
- Write in clear American English, short sentences, active voice, second person.
- Open with a 2–3 sentence paragraph that answers the query and contains the focus keyword.
- Use descriptive H2/H3 headings; numbered steps for procedures; comparison tables when useful.
- 900–1800 words. End with an FAQ (3–5 real questions people ask).
- 2–4 internal links to posts on the same blog (path "/slug") and 1–3 links to reliable sources.
- Never invent numbers, prices, features or statistics. If you can't source it, don't claim it.
- No H1 in the body (the title is the H1). No emojis.`;

export const SEED_BLOGS: SeedBlog[] = [
  {
    slug: "bolsoemdia",
    name: "Bolso em Dia",
    tagline: "Dinheiro e direitos explicados sem complicação.",
    description: "Guias passo a passo sobre FGTS, Imposto de Renda, INSS, cartões, Pix e economia doméstica.",
    niche: "Finanças pessoais e benefícios",
    language: "pt-BR",
    theme: "minimal",
    brandColor: "#059669",
    aiPostStatus: "review",
    affiliateDisclosure: "Este conteúdo pode conter links de parceiros. Se você contratar por eles, podemos receber uma comissão, sem custo extra para você.",
    editorialGuide: `Público: adultos 25–55 anos, classes C/B, leem no celular, querem "como fazer" e "quem tem direito".
Tom: claro, direto, acolhedor, sem juridiquês. Explique termos técnicos na primeira vez que aparecem.
Tema sensível (YMYL – dinheiro): cite SEMPRE fontes oficiais (gov.br, Receita Federal, Caixa, INSS, Banco Central) e informe que regras podem mudar.
Mostre valores e prazos apenas com fonte e com o ano de referência.
Estrutura preferida: resposta direta → resumo rápido → passo a passo → quem tem direito / requisitos → erros comuns → FAQ.
Nunca recomende investimento específico como garantia de retorno.${PT_RULES}`,
    categories: ["Benefícios e Direitos", "Imposto de Renda", "Cartão de Crédito", "Pix e Bancos", "Economizar", "Investir do Zero"],
    topics: [
      ["consultar saldo fgts", "Como consultar o saldo do FGTS pelo celular (passo a passo)", "Tutorial", "FGTS"],
      ["saque aniversário fgts vale a pena", "Saque-aniversário do FGTS: vale a pena? Prós, contras e simulação", "Decisão", "FGTS"],
      ["como aumentar score", "Como aumentar o score de crédito: 9 atitudes que funcionam", "Tutorial", "Cartões"],
      ["cartão sem anuidade", "Melhores cartões de crédito sem anuidade (comparativo)", "Comercial", "Cartões"],
      ["consultar restituição ir", "Restituição do Imposto de Renda: como consultar e quando cai", "Tutorial", "Imposto de Renda"],
      ["quem deve declarar imposto de renda", "Quem é obrigado a declarar Imposto de Renda", "Informativo", "Imposto de Renda"],
      ["pix automático", "Pix agendado e Pix automático: como funcionam", "Informativo", "Pix"],
      ["como sair das dívidas", "Como sair das dívidas: método em 5 passos", "Tutorial", "Orçamento"],
      ["planilha de gastos mensais", "Planilha de gastos mensais grátis + como usar", "Ferramenta", "Orçamento"],
      ["como pedir auxílio doença", "Como pedir auxílio-doença no INSS pelo Meu INSS", "Tutorial", "INSS"],
      ["reserva de emergência", "Reserva de emergência: quanto guardar e onde deixar", "Informativo", "Investimentos"],
      ["cdb ou tesouro selic", "CDB, Tesouro Selic ou poupança: onde render mais", "Decisão", "Investimentos"],
    ],
  },
  {
    slug: "cliquecerto",
    name: "Clique Certo",
    tagline: "Tecnologia sem complicação.",
    description: "Tutoriais de celular, WhatsApp e apps, dicas de segurança digital e guias de compra honestos.",
    niche: "Tecnologia e guias de compra",
    language: "pt-BR",
    theme: "magazine",
    brandColor: "#2563EB",
    aiPostStatus: "scheduled",
    affiliateDisclosure: "Alguns links são de afiliados (Amazon, Mercado Livre e outros). Ao comprar por eles, você apoia o site sem pagar nada a mais.",
    editorialGuide: `Público: usuários comuns de Android e iPhone, 18–60 anos, que travam em configurações e querem comprar bem.
Tom: amigável, prático, como um amigo que entende de tecnologia.
Sempre diga se o passo a passo vale para Android, iPhone ou ambos, e cite caminhos de menu entre aspas ("Configurações > Bateria").
Guias de compra: critérios claros (para quem é, prós, contras, faixa de preço). Não invente especificações nem preços; preços mudam, use faixas e diga "consulte o valor atualizado".
Segurança: explique golpes sem instruir a aplicá-los.${PT_RULES}`,
    categories: ["WhatsApp", "Celular", "Apps e Serviços", "Guias de Compra", "Segurança Digital", "PC e Notebook"],
    topics: [
      ["recuperar conversas whatsapp", "Como recuperar conversas apagadas do WhatsApp", "Tutorial", "WhatsApp"],
      ["melhor celular até 1500", "Melhores celulares até R$ 1.500", "Comercial", "Celulares por preço"],
      ["celular lento o que fazer", "Celular lento? 10 formas de deixar mais rápido", "Tutorial", "Desempenho"],
      ["liberar espaço celular", "Como liberar espaço no celular sem apagar fotos", "Tutorial", "Desempenho"],
      ["golpe whatsapp", "Golpes no WhatsApp: os mais comuns e como se proteger", "Informativo", "Segurança"],
      ["verificação em duas etapas", "Como ativar a verificação em duas etapas em todos os apps", "Tutorial", "Segurança"],
      ["fone bluetooth bom e barato", "Melhores fones bluetooth baratos", "Comercial", "Guias de compra"],
      ["bateria acabando rápido", "Bateria do celular acabando rápido: causas e soluções", "Tutorial", "Desempenho"],
      ["transferir android para iphone", "Como transferir dados do Android para o iPhone", "Tutorial", "Celular"],
      ["notebook para estudar", "Melhor notebook para estudar (custo-benefício)", "Comercial", "Guias de compra"],
      ["espelhar celular na tv", "Como espelhar a tela do celular na TV", "Tutorial", "Celular"],
      ["gerenciador de senhas grátis", "Gerenciador de senhas: o que é e qual usar grátis", "Decisão", "Segurança"],
    ],
  },
  {
    slug: "larpratico",
    name: "Lar Prático",
    tagline: "Casa limpa, organizada e comida fácil.",
    description: "Truques de limpeza, organização, economia em casa e receitas práticas na air fryer.",
    niche: "Casa, limpeza e cozinha prática",
    language: "pt-BR",
    theme: "magazine",
    brandColor: "#EA580C",
    aiPostStatus: "scheduled",
    affiliateDisclosure: "Este post tem links de afiliados. Se você comprar por eles, ganhamos uma pequena comissão, sem custo extra para você.",
    editorialGuide: `Público: quem cuida da casa (25–55 anos), quem mora sozinho, iniciantes na cozinha. Muito tráfego do Pinterest e do Google Discover.
Tom: acolhedor, prático, "testado em casa", sem julgamentos.
Truques de limpeza: liste materiais, tempo e custo aproximado; avise sobre misturas perigosas (ex.: nunca misturar água sanitária com amoníaco ou vinagre) e teste em área pequena.
Receitas: ingredientes com medidas, tempo e temperatura, rendimento, passo a passo numerado e dicas de variação.
Comparativos de eletroportáteis: critérios (capacidade, potência, consumo, limpeza), sem inventar especificações ou preços.${PT_RULES}`,
    categories: ["Limpeza", "Organização", "Receitas na Air Fryer", "Cozinha Prática", "Eletroportáteis", "Economia em Casa"],
    topics: [
      ["como limpar air fryer", "Como limpar air fryer por dentro (sem estragar)", "Tutorial", "Air fryer"],
      ["batata na air fryer", "Batata frita na air fryer crocante: tempo e temperatura", "Receita", "Air fryer"],
      ["tirar mancha de gordura", "Como tirar mancha de gordura da roupa", "Tutorial", "Manchas"],
      ["melhor air fryer", "Melhor air fryer custo-benefício (comparativo)", "Comercial", "Air fryer"],
      ["desentupir pia", "Como desentupir pia sem chamar encanador", "Tutorial", "Limpeza por cômodo"],
      ["organizar guarda roupa", "Como organizar guarda-roupa pequeno", "Tutorial", "Organização"],
      ["frango na air fryer", "Frango na air fryer suculento: 5 receitas", "Receita", "Air fryer"],
      ["tirar mofo da parede", "Como tirar mofo da parede de vez", "Tutorial", "Limpeza por cômodo"],
      ["robô aspirador vale a pena", "Robô aspirador vale a pena? Qual comprar", "Decisão", "Eletroportáteis"],
      ["cronograma de limpeza", "Cronograma de limpeza semanal (com checklist para imprimir)", "Ferramenta", "Organização"],
      ["economizar conta de luz", "Como economizar na conta de luz: 15 dicas", "Tutorial", "Economia"],
      ["limpar box banheiro", "Como limpar box de banheiro e deixar brilhando", "Tutorial", "Limpeza por cômodo"],
    ],
  },
  {
    slug: "stackwise",
    name: "Stackwise",
    tagline: "The right software stack for small businesses.",
    description: "Honest comparisons, alternatives and how-tos for SaaS and AI tools used by freelancers and small businesses.",
    niche: "Small business software & AI tools",
    language: "en",
    theme: "minimal",
    brandColor: "#7C3AED",
    aiPostStatus: "review",
    affiliateDisclosure: "Some links on this page are affiliate links. We may earn a commission if you sign up, at no extra cost to you. It never affects our recommendations.",
    editorialGuide: `Audience: freelancers, solopreneurs and small business owners in the US/UK/CA/AU.
Tone: honest, practical, no hype. Always include "Who it's for" and "Who should skip it".
Comparisons: use a table (pricing tier names, free plan yes/no, key limits), pros/cons, and a clear verdict per use case.
Pricing changes often: say "check current pricing" and avoid exact numbers unless sourced from the vendor's pricing page with the month/year.
Never claim you tested a feature unless the editor confirms it; describe features from official docs and link them.
Prefer long-tail angles: "X alternatives for Y", "X vs Y for freelancers", "how to do Z with X".${EN_RULES}`,
    categories: ["AI Tools", "CRM & Sales", "Email Marketing", "Website Builders", "Accounting & Invoicing", "Productivity"],
    topics: [
      ["best free crm for small business", "Best Free CRM for Small Business (Tested Options)", "Commercial", "Free CRM"],
      ["ai writing tools for small business", "Best AI Writing Tools for Small Business Marketing", "Commercial", "AI tools"],
      ["mailchimp alternatives", "Mailchimp Alternatives That Are Cheaper", "Commercial", "Email marketing"],
      ["automate invoicing freelancer", "How to Automate Invoicing as a Freelancer", "Tutorial", "Invoicing"],
      ["notion vs clickup", "Notion vs ClickUp for Small Teams", "Decision", "Productivity"],
      ["best website builder small business", "Best Website Builder for Small Business", "Commercial", "Website builders"],
      ["ai customer email responses", "How to Use AI to Answer Customer Emails", "Tutorial", "AI tools"],
      ["accounting software for freelancers", "Best Accounting Software for Freelancers", "Commercial", "Invoicing"],
      ["zapier alternatives", "Zapier Alternatives for Small Business Automation", "Commercial", "Automation"],
      ["small business tech stack", "How to Build a Lean Tech Stack Under $100/Month", "Informational", "Stack"],
      ["best scheduling app for small business", "Best Scheduling Apps for Client Appointments", "Commercial", "Productivity"],
      ["what is a crm", "What Is a CRM and Does Your Small Business Need One?", "Informational", "Free CRM"],
    ],
  },
  {
    slug: "leafycorner",
    name: "Leafy Corner",
    tagline: "Indoor plants and small-space gardening made simple.",
    description: "Plant care guides, troubleshooting and small balcony garden ideas for beginners.",
    niche: "Indoor plants & small-space gardening",
    language: "en",
    theme: "editorial",
    brandColor: "#4D7C0F",
    aiPostStatus: "scheduled",
    affiliateDisclosure: "As an Amazon Associate we earn from qualifying purchases. Some links are affiliate links, at no extra cost to you.",
    editorialGuide: `Audience: millennials and Gen Z living in apartments (US/UK), plant beginners. Strong Pinterest traffic.
Tone: calm, warm, encouraging, beginner-friendly.
Every species care guide starts (after the intro) with a "Quick care card" as a bullet list: Light, Water, Soil, Humidity, Temperature, Toxicity to pets (cite ASPCA for toxicity).
Troubleshooting posts: list causes from most to least likely, how to diagnose each, and the fix.
Use common name + scientific name in italics on first mention.${EN_RULES}`,
    categories: ["Plant Care Guides", "Plant Problems", "Low-Light Plants", "Pet-Safe Plants", "Balcony & Small Gardens", "Tools & Supplies"],
    topics: [
      ["pothos care", "Pothos Care Guide: Light, Water and Propagation", "Guide", "Care guides"],
      ["plant leaves turning yellow", "Why Are My Plant Leaves Turning Yellow? 9 Causes", "Problem", "Problems"],
      ["low light indoor plants", "Best Low-Light Indoor Plants for Dark Apartments", "List", "Plants by condition"],
      ["pet safe houseplants", "Pet-Safe Houseplants for Cats and Dogs", "List", "Plants by condition"],
      ["snake plant care", "Snake Plant Care: The Complete Beginner Guide", "Guide", "Care guides"],
      ["get rid of fungus gnats", "How to Get Rid of Fungus Gnats in Houseplants", "Problem", "Problems"],
      ["best grow lights indoor plants", "Best Grow Lights for Indoor Plants", "Commercial", "Tools"],
      ["monstera care", "Monstera Deliciosa Care Guide", "Guide", "Care guides"],
      ["how often water indoor plants", "How Often Should You Water Indoor Plants?", "Informational", "Basics"],
      ["balcony vegetable garden", "Small Balcony Vegetable Garden: What to Grow", "Guide", "Balcony"],
      ["propagate plants in water", "How to Propagate Plants in Water", "Tutorial", "Basics"],
      ["best soil for indoor plants", "Best Soil for Indoor Plants (and When to Repot)", "Commercial", "Tools"],
    ],
  },
];
