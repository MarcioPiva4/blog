/** Configuração lida do ambiente (somente no servidor). */
export const config = {
  rootDomain: process.env.ROOT_DOMAIN ?? "localhost",
  adminHost: process.env.ADMIN_HOST ?? "painel.localhost",
  protocol: process.env.PUBLIC_PROTOCOL ?? "http",
  port: process.env.PUBLIC_PORT ?? "",
  indexNowKey: process.env.INDEXNOW_KEY ?? "",
  mediaDir: process.env.MEDIA_DIR ?? "./media",
};

/** Página de tag só é indexada (e entra no sitemap) a partir deste nº de posts — evita páginas rasas. */
export const TAG_INDEX_MIN_POSTS = 3;

/** Subdomínios que não podem virar slug de blog. */
export const RESERVED_SLUGS = new Set(["painel", "admin", "www", "api", "app", "mail", "static", "cdn"]);

export function hostWithPort(host: string) {
  return config.port ? `${host}:${config.port}` : host;
}

export function adminUrl(path = "") {
  return `${config.protocol}://${hostWithPort(config.adminHost)}${path}`;
}
