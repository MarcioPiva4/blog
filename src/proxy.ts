import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

const ADMIN_HOST = (process.env.ADMIN_HOST ?? "painel.localhost").toLowerCase();
const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? "";

/** Rotas de API que respondem em qualquer host (blogs públicos usam). */
const PUBLIC_API = ["/api/track", "/api/media/"];

export async function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const { pathname } = req.nextUrl;

  if (INDEXNOW_KEY && pathname === `/${INDEXNOW_KEY}.txt`) {
    return new NextResponse(INDEXNOW_KEY, { headers: { "content-type": "text/plain" } });
  }

  // ---------- Painel ----------
  if (host === ADMIN_HOST) {
    if (pathname.startsWith("/sites")) return new NextResponse(null, { status: 404 });
    if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url));
    if (pathname.startsWith("/dashboard")) {
      const token = req.cookies.get(SESSION_COOKIE)?.value;
      if (!token || !(await verifySession(token))) {
        const url = new URL("/login", req.url);
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // ---------- Blogs públicos ----------
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/api/") || pathname.startsWith("/dashboard") || pathname.startsWith("/login")) {
    return new NextResponse(null, { status: 404 });
  }
  const url = req.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(host)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Tudo, exceto assets do Next e arquivos estáticos de /public
  matcher: ["/((?!_next/|favicon.ico|icon.svg).*)"],
};
