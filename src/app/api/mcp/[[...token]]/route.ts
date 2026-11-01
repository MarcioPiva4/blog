import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { verifyApiKey } from "@/lib/api-keys";
import { createMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Servidor MCP (Streamable HTTP, stateless).
 * Autenticação: header "Authorization: Bearer rbk_..." ou URL secreta /api/mcp/rbk_...
 * (a URL secreta existe para clientes que só aceitam conectores sem header).
 */
async function handle(req: Request, ctx: { params: Promise<{ token?: string[] }> }) {
  const { token } = await ctx.params;
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = await verifyApiKey(header || token?.[0]);
  if (!key) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const server = createMcpServer(key);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
