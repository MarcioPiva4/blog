import { eq } from "drizzle-orm";
import { slugify } from "../lib/utils";
import { db } from "./index";
import { authors, blogs, categories, topicQueue } from "./schema";
import { SEED_BLOGS } from "./seed-data";

/** Cria os blogs iniciais. Idempotente: blogs já existentes (mesmo slug) são pulados. */
async function main() {
  for (const s of SEED_BLOGS) {
    const existing = await db.query.blogs.findFirst({ where: eq(blogs.slug, s.slug) });
    if (existing) {
      console.log(`• ${s.name} já existe (id ${existing.id}), pulando`);
      continue;
    }
    const { categories: cats, topics, ...data } = s;
    const [blog] = await db.insert(blogs).values({ ...data, postsPerDay: 1, inContentAdAfter: 3 }).returning();

    await db.insert(categories).values(cats.map((name, position) => ({ blogId: blog.id, name, slug: slugify(name), position })));
    await db.insert(authors).values({
      blogId: blog.id,
      name: s.language === "en" ? `${s.name} Team` : `Equipe ${s.name}`,
      slug: "redacao",
      bio: s.language === "en" ? `The editorial team behind ${s.name}. We research, write and update every guide.` : `Equipe editorial do ${s.name}. Pesquisamos, escrevemos e atualizamos cada guia.`,
    });
    await db.insert(topicQueue).values(
      topics.map(([keyword, title, intent, cluster], i) => ({ blogId: blog.id, keyword, title, intent, cluster, priority: 100 - i })),
    );
    console.log(`✓ ${s.name} criado (id ${blog.id}) com ${cats.length} categorias e ${topics.length} pautas`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
