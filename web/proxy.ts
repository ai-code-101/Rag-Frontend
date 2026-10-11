// Security headers for every page. The chat iframe (/widget/<key>) may only be framed by
// the bot's allowed origins (CSP frame-ancestors); everything else may not be framed at all
// except by this app itself (the widget preview in the dashboard).
import { NextResponse, type NextRequest } from "next/server";
import { frameAncestors, getPublicConfig, validPublicKey } from "@/lib/widget-public";

// Small per-instance cache so frame-ancestors doesn't cost an API call per page view.
const cache = new Map<string, { value: string; expires: number }>();

async function ancestorsFor(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const cfg = await getPublicConfig(key);
  if (!cfg) return null;
  const value = frameAncestors(cfg.allowed_origins);
  if (cache.size > 5000) cache.clear();
  cache.set(key, { value, expires: Date.now() + 60_000 });
  return value;
}

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const h = res.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/widget/")) {
    const key = pathname.split("/")[2] ?? "";
    const ancestors = validPublicKey(key) ? await ancestorsFor(key) : null;
    // Unknown bot: deny framing entirely (the page renders "not found").
    h.set("Content-Security-Policy", `frame-ancestors ${ancestors ?? "'none'"}`);
  } else {
    h.set("Content-Security-Policy", "frame-ancestors 'self'");
    h.set("X-Frame-Options", "SAMEORIGIN");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|widget.js|api/).*)"],
};
