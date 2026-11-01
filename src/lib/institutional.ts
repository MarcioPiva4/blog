import type { Blog, BlogLanguage } from "@/db/schema";

export type InstitutionalKey = "about" | "contact" | "privacy" | "terms";

const SLUGS: Record<BlogLanguage, Record<InstitutionalKey, string>> = {
  "pt-BR": { about: "sobre", contact: "contato", privacy: "politica-de-privacidade", terms: "termos-de-uso" },
  en: { about: "about", contact: "contact", privacy: "privacy-policy", terms: "terms-of-use" },
};

export function institutionalSlugs(lang: BlogLanguage) {
  return SLUGS[lang] ?? SLUGS["pt-BR"];
}

/** Slugs que nenhum post pode usar (em qualquer idioma). */
export const RESERVED_POST_SLUGS = new Set([...Object.values(SLUGS["pt-BR"]), ...Object.values(SLUGS.en), "categoria", "autor", "pagina", "og", "feed", "api"]);

export function institutionalKeyFor(lang: BlogLanguage, slug: string): InstitutionalKey | null {
  const entry = Object.entries(institutionalSlugs(lang)).find(([, s]) => s === slug);
  return (entry?.[0] as InstitutionalKey) ?? null;
}

/** Textos-base (Markdown) das páginas exigidas pelo AdSense. Revise antes de pedir aprovação. */
export function institutionalPage(blog: Blog, key: InstitutionalKey, baseUrl: string): { title: string; md: string } {
  const email = blog.contactEmail ?? "";
  const host = baseUrl.replace(/^https?:\/\//, "");
  if (blog.language === "en") {
    switch (key) {
      case "about":
        return {
          title: `About ${blog.name}`,
          md: `${blog.description || blog.tagline}\n\n## What we cover\n\n${blog.name} publishes practical, well-researched guides about ${blog.niche.toLowerCase() || "our topics"}. Every article is reviewed and updated when information changes.\n\n## Editorial standards\n\n- We cite reliable sources and link to them.\n- We update articles when facts change and show the update date.\n- Some articles contain affiliate links. This never changes our recommendations.\n\n## Contact\n\nQuestions or corrections? See our [contact page](/contact).`,
        };
      case "contact":
        return {
          title: "Contact",
          md: `We read every message. For corrections, suggestions or partnerships, email us${email ? ` at **[${email}](mailto:${email})**` : ""}.\n\nWe usually reply within 2 business days.`,
        };
      case "privacy":
        return {
          title: "Privacy Policy",
          md: `This policy explains how ${host} handles information.\n\n## Analytics\n\nWe count page views without cookies and without storing IP addresses. We record the page, referring website, device type and approximate country.\n\n## Advertising\n\nWe may show ads from Google AdSense. Google and its partners use cookies to serve ads based on prior visits to this and other websites. You can opt out of personalized advertising at [Google Ads Settings](https://adssettings.google.com). Learn more at [How Google uses information from sites that use its services](https://policies.google.com/technologies/partner-sites).\n\n## Affiliate links\n\nSome links are affiliate links. If you buy through them we may earn a commission at no extra cost to you.\n\n## Contact\n\nFor privacy requests${email ? ` email [${email}](mailto:${email})` : " use our contact page"}.`,
        };
      case "terms":
        return {
          title: "Terms of Use",
          md: `By using ${host} you agree to these terms.\n\n## Content\n\nArticles are for general information only and are not professional advice. Always check official sources before making decisions.\n\n## Intellectual property\n\nContent may not be republished without permission. Short quotes with a link to the original are welcome.\n\n## Changes\n\nWe may update these terms at any time. The current version is always on this page.`,
        };
    }
  }
  switch (key) {
    case "about":
      return {
        title: `Sobre o ${blog.name}`,
        md: `${blog.description || blog.tagline}\n\n## O que publicamos\n\nO ${blog.name} publica guias práticos e bem pesquisados sobre ${blog.niche.toLowerCase() || "nossos temas"}. Todo artigo é revisado e atualizado quando as informações mudam.\n\n## Padrões editoriais\n\n- Citamos fontes confiáveis e oficiais, com link.\n- Atualizamos os artigos quando algo muda e mostramos a data da atualização.\n- Alguns artigos têm links de afiliados. Isso nunca muda nossas recomendações.\n\n## Contato\n\nDúvidas ou correções? Veja nossa [página de contato](/contato).`,
      };
    case "contact":
      return {
        title: "Contato",
        md: `Lemos todas as mensagens. Para correções, sugestões ou parcerias, escreva para${email ? ` **[${email}](mailto:${email})**` : " nós"}.\n\nCostumamos responder em até 2 dias úteis.`,
      };
    case "privacy":
      return {
        title: "Política de Privacidade",
        md: `Esta política explica como o ${host} trata informações, conforme a Lei Geral de Proteção de Dados (LGPD).\n\n## Estatísticas\n\nContamos visualizações sem cookies e sem armazenar endereço IP. Registramos a página, o site de origem, o tipo de dispositivo e o país aproximado.\n\n## Publicidade\n\nPodemos exibir anúncios do Google AdSense. O Google e seus parceiros usam cookies para exibir anúncios com base em visitas anteriores a este e a outros sites. Você pode desativar a publicidade personalizada nas [Configurações de anúncios do Google](https://adssettings.google.com). Saiba mais em [Como o Google usa informações de sites parceiros](https://policies.google.com/technologies/partner-sites).\n\n## Links de afiliados\n\nAlguns links são de afiliados. Se você comprar por eles, podemos receber uma comissão, sem custo extra para você.\n\n## Seus direitos\n\nVocê pode solicitar acesso, correção ou exclusão de dados${email ? ` pelo e-mail [${email}](mailto:${email})` : " pela página de contato"}.`,
      };
    case "terms":
      return {
        title: "Termos de Uso",
        md: `Ao usar o ${host} você concorda com estes termos.\n\n## Conteúdo\n\nOs artigos têm caráter informativo e não substituem orientação profissional. Confira sempre as fontes oficiais antes de tomar decisões.\n\n## Propriedade intelectual\n\nO conteúdo não pode ser republicado sem autorização. Citações curtas com link para o original são bem-vindas.\n\n## Alterações\n\nEstes termos podem ser atualizados a qualquer momento. A versão vigente está sempre nesta página.`,
      };
  }
}
