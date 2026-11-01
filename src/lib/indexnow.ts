import { config } from "./config";

/** Avisa Bing/Yandex/Seznam (IndexNow) sobre URLs novas ou alteradas. Ignora localhost. */
export async function pingIndexNow(urls: string[]) {
  if (!config.indexNowKey || !urls.length) return;
  const byHost = new Map<string, string[]>();
  for (const u of urls) {
    const host = new URL(u).hostname;
    if (host === "localhost" || host.endsWith(".localhost")) continue;
    byHost.set(host, [...(byHost.get(host) ?? []), u]);
  }
  await Promise.allSettled(
    [...byHost].map(([host, urlList]) =>
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host,
          key: config.indexNowKey,
          keyLocation: `https://${host}/${config.indexNowKey}.txt`,
          urlList,
        }),
        signal: AbortSignal.timeout(5000),
      }),
    ),
  );
}
