import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/db";
import { apiKeys, mcpLogs } from "@/db/schema";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Table } from "@/components/ui";
import { createApiKey } from "@/lib/api-keys";
import { requireAdmin } from "@/lib/auth";
import { adminUrl } from "@/lib/config";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Integração IA (MCP)" };

const FLASH_COOKIE = "rb_new_key";

async function createKey(formData: FormData) {
  "use server";
  await requireAdmin();
  const name = String(formData.get("name") || "Cowork");
  const { key } = await createApiKey(name);
  // A chave em claro é mostrada uma única vez (cookie de vida curta)
  (await cookies()).set(FLASH_COOKIE, key, { httpOnly: true, maxAge: 120, path: "/dashboard/mcp", sameSite: "strict" });
  redirect("/dashboard/mcp");
}

async function revokeKey(id: number) {
  "use server";
  await requireAdmin();
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
  redirect("/dashboard/mcp");
}

export default async function McpPage() {
  const jar = await cookies();
  const newKey = jar.get(FLASH_COOKIE)?.value;

  const [keys, logs] = await Promise.all([
    db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)),
    db.select().from(mcpLogs).orderBy(desc(mcpLogs.createdAt)).limit(50),
  ]);
  const endpoint = adminUrl("/api/mcp");

  return (
    <>
      <PageHeader title="Integração IA (MCP)" description="Conecte o Claude (Cowork, Claude Desktop ou Claude Code) para escrever e agendar posts." />

      {newKey && (
        <Card className="mb-6 border-emerald-500/40 p-5">
          <p className="font-medium">Chave criada — copie agora, ela não será mostrada de novo:</p>
          <code className="mt-2 block break-all rounded-lg bg-muted p-3 font-mono text-sm">{newKey}</code>
          <p className="mt-3 text-sm text-muted-foreground">URL secreta (para conectores que não aceitam header):</p>
          <code className="mt-1 block break-all rounded-lg bg-muted p-3 font-mono text-xs">
            {endpoint}/{newKey}
          </code>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Como conectar" />
          <div className="space-y-3 p-5 text-sm">
            <p>
              <b>Endpoint:</b> <code className="font-mono text-xs">{endpoint}</code>
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>Crie uma chave ao lado.</li>
              <li>
                No Claude: <i>Configurações → Conectores → Adicionar conector personalizado</i> e cole a <b>URL secreta</b> (<code>/api/mcp/rbk_…</code>).
              </li>
              <li>
                No Cowork, crie uma <b>tarefa agendada diária</b>: “Para cada blog de list_blogs, use o prompt post_diario”.
              </li>
              <li>Acompanhe as chamadas no log abaixo.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Clientes com suporte a header: <code>Authorization: Bearer rbk_…</code> em <code>{endpoint}</code>. Trate a URL secreta como senha.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Chaves de API" />
          <form action={createKey} className="flex items-end gap-2 border-b p-5">
            <Field label="Nome" className="flex-1">
              <Input name="name" placeholder="Cowork" />
            </Field>
            <Button>Criar chave</Button>
          </form>
          {keys.length ? (
            <ul className="divide-y text-sm">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="font-medium">
                      {k.name} <span className="font-mono text-xs text-muted-foreground">{k.prefix}…</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Último uso: {formatDateTime(k.lastUsedAt)}</p>
                  </div>
                  {k.revokedAt ? (
                    <Badge color="red">Revogada</Badge>
                  ) : (
                    <form action={revokeKey.bind(null, k.id)}>
                      <Button variant="ghost" size="sm">Revogar</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted-foreground">Nenhuma chave.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Log de chamadas" description="Últimas 50 chamadas de ferramentas." />
        {logs.length ? (
          <Table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ferramenta</th>
                <th>Resultado</th>
                <th className="text-right">ms</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                  <td className="font-mono text-xs">{l.tool}</td>
                  <td className="max-w-md">
                    <Badge color={l.ok ? "green" : "red"}>{l.ok ? "ok" : "erro"}</Badge>
                    <span className="ml-2 line-clamp-1 inline text-xs text-muted-foreground">{l.result.slice(0, 140)}</span>
                  </td>
                  <td className="text-right tabular-nums text-muted-foreground">{l.durationMs}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState title="Nenhuma chamada ainda" />
          </div>
        )}
      </Card>
    </>
  );
}
