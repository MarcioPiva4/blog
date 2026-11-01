"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blogs, topicQueue } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";

type Position = "start" | "end";

const id = z.number().int().positive();

const topicFields = z.object({
  keyword: z
    .string()
    .trim()
    .min(2, "A palavra-chave precisa ter pelo menos 2 letras")
    .max(120, "Palavra-chave muito longa (máx. 120 caracteres)")
    .transform((s) => s.toLowerCase()),
  title: z.string().trim().max(200, "Título muito longo (máx. 200 caracteres)").default(""),
  intent: z.string().trim().max(60, "Intenção muito longa (máx. 60 caracteres)").default(""),
  cluster: z.string().trim().max(60, "Cluster muito longo (máx. 60 caracteres)").default(""),
  notes: z.string().trim().max(2000, "Notas muito longas (máx. 2000 caracteres)").default(""),
});

const fail = (error: string): ActionResult => ({ ok: false, error });
const issue = (e: z.ZodError) => fail(e.issues[0]?.message ?? "Dados inválidos");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const inQueue = (blogId: number) => and(eq(topicQueue.blogId, blogId), eq(topicQueue.status, "idea"));

/**
 * A IA (get_next_topic) pega a pauta de maior prioridade. Depois de cada mudança a fila do blog
 * é renumerada como n…1 na ordem atual, para a lista do painel ser exatamente a ordem da IA.
 */
async function normalizeQueue(blogId: number) {
  await db.execute(sql`
    update topic_queue t set priority = s.p
    from (
      select id, (count(*) over () - row_number() over (order by priority desc, id asc) + 1)::int as p
      from topic_queue where blog_id = ${blogId} and status = 'idea'
    ) s
    where t.id = s.id`);
}

async function queueEdge(blogId: number, position: Position) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${topicQueue.priority})`, min: sql<number | null>`min(${topicQueue.priority})` })
    .from(topicQueue)
    .where(inQueue(blogId));
  return Number((position === "start" ? row?.max : row?.min) ?? 0);
}

export async function addTopicsAction(blogId: number, topics: z.input<typeof topicFields>[], position: Position): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(topicFields).min(1, "Digite pelo menos uma palavra-chave").max(200, "Máximo de 200 pautas por vez").safeParse(topics);
  if (!parsed.success) return issue(parsed.error);
  if (!(await db.$count(blogs, eq(blogs.id, blogId)))) return fail("Blog não encontrado");

  const pos: Position = position === "start" ? "start" : "end";
  const unique = [...new Map(parsed.data.map((t) => [t.keyword, t])).values()];
  const edge = await queueEdge(blogId, pos);
  // No início: acima da maior prioridade; no fim: abaixo da menor. A ordem digitada é mantida.
  const rows = unique.map((t, i) => ({ blogId, ...t, priority: pos === "start" ? edge + unique.length - i : edge - 1 - i }));
  const created = await db.insert(topicQueue).values(rows).onConflictDoNothing().returning({ keyword: topicQueue.keyword });
  if (!created.length) {
    return fail(
      parsed.data.length === 1
        ? "Essa palavra-chave já está na pauta deste blog (veja também Escritas, Publicadas e Descartadas)"
        : "Todas essas palavras-chave já estão na pauta deste blog",
    );
  }
  await normalizeQueue(blogId);

  const skipped = parsed.data.length - created.length;
  const what = created.length === 1 ? `Pauta “${created[0].keyword}” adicionada` : `${created.length} pautas adicionadas`;
  const where = pos === "start" ? "no início da fila" : "no fim da fila";
  return { ok: true, message: `${what} ${where}${skipped ? ` (${plural(skipped, "repetida ignorada", "repetidas ignoradas")})` : ""}` };
}

export async function updateTopicAction(blogId: number, raw: z.input<typeof topicFields> & { id: number }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = topicFields.extend({ id }).safeParse(raw);
  if (!parsed.success) return issue(parsed.error);
  const { id: topicId, ...values } = parsed.data;

  const clash = await db.query.topicQueue.findFirst({
    where: and(eq(topicQueue.blogId, blogId), eq(topicQueue.keyword, values.keyword), ne(topicQueue.id, topicId)),
  });
  if (clash) return fail("Já existe outra pauta com essa palavra-chave neste blog");

  const [row] = await db
    .update(topicQueue)
    .set(values)
    .where(and(eq(topicQueue.id, topicId), eq(topicQueue.blogId, blogId)))
    .returning({ id: topicQueue.id });
  if (!row) return fail("Pauta não encontrada");
  return { ok: true, message: "Pauta atualizada" };
}

/** Recebe todas as pautas "na fila" do blog na nova ordem (a primeira é a próxima da IA). */
export async function reorderTopicsAction(blogId: number, ids: number[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(id).safeParse(ids);
  if (!parsed.success) return fail("Ordem inválida");
  const current = await db.select({ id: topicQueue.id }).from(topicQueue).where(inQueue(blogId));
  const same = current.length === parsed.data.length && current.every((t) => parsed.data.includes(t.id));
  if (!same) return fail("A fila mudou enquanto você editava (a IA pode ter pegado uma pauta). A lista foi atualizada; tente de novo.");
  await db.transaction(async (tx) => {
    for (const [index, topicId] of parsed.data.entries()) {
      await tx.update(topicQueue).set({ priority: parsed.data.length - index }).where(eq(topicQueue.id, topicId));
    }
  });
  return { ok: true, message: "Ordem da fila salva" };
}

/** Descartar (sai da fila) ou devolver à fila: vinda de "Em produção" volta no início; de "Descartadas", no fim. */
export async function setTopicStatusAction(blogId: number, topicId: number, status: "idea" | "discarded"): Promise<ActionResult> {
  await requireAdmin();
  const topic = await db.query.topicQueue.findFirst({ where: and(eq(topicQueue.id, topicId), eq(topicQueue.blogId, blogId)) });
  if (!topic) return fail("Pauta não encontrada");
  if (topic.status === "written" || topic.status === "published") return fail("Esta pauta já virou post");

  if (status === "discarded") {
    await db.update(topicQueue).set({ status: "discarded", assignedAt: null }).where(eq(topicQueue.id, topic.id));
    await normalizeQueue(blogId);
    return { ok: true, message: `“${topic.keyword}” foi descartada. Dá para restaurar na aba Descartadas.` };
  }

  if (topic.status === "idea") return fail("Esta pauta já está na fila");
  const position: Position = topic.status === "assigned" ? "start" : "end";
  const edge = await queueEdge(blogId, position);
  await db
    .update(topicQueue)
    .set({ status: "idea", assignedAt: null, priority: position === "start" ? edge + 1 : edge - 1 })
    .where(eq(topicQueue.id, topic.id));
  await normalizeQueue(blogId);
  return { ok: true, message: position === "start" ? `“${topic.keyword}” voltou para o início da fila` : `“${topic.keyword}” voltou para o fim da fila` };
}

/** Exclusão definitiva, só de descartadas: libera a palavra-chave para ser usada de novo. */
export async function deleteTopicAction(blogId: number, topicId: number): Promise<ActionResult> {
  await requireAdmin();
  const [row] = await db
    .delete(topicQueue)
    .where(and(eq(topicQueue.id, topicId), eq(topicQueue.blogId, blogId), eq(topicQueue.status, "discarded")))
    .returning({ keyword: topicQueue.keyword });
  if (!row) return fail("Só pautas descartadas podem ser excluídas");
  return { ok: true, message: `Pauta “${row.keyword}” excluída` };
}
