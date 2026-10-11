// Same-origin proxy to the Go API. Keeps the refresh cookie first-party (even when the
// web app and API sit on different sites, e.g. two *.run.app services) and is resolved at
// runtime from API_INTERNAL_URL. Request and response bodies are streamed, so uploads and
// SSE chat streams pass through without buffering.
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const FORWARD_REQUEST = ["authorization", "content-type", "cookie", "x-requested-with", "origin", "accept", "if-none-match", "user-agent"];
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path[0] !== "v1" || path.some((p) => p === ".." || p.includes("/"))) {
    return Response.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });
  }
  const url = new URL(req.url);
  const target = `${serverEnv.apiInternalUrl}/${path.map(encodeURIComponent).join("/")}${url.search}`;

  const headers = new Headers();
  for (const h of FORWARD_REQUEST) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const fwd = req.headers.get("x-forwarded-for");
  const ip = req.headers.get("x-real-ip");
  if (fwd || ip) headers.set("x-forwarded-for", fwd ?? ip ?? "");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-expect-error -- Node fetch requires duplex for streamed request bodies
      duplex: hasBody ? "half" : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return Response.json({ error: { code: "upstream_unavailable", message: "Service unavailable." } }, { status: 502 });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key) && key !== "set-cookie") out.set(key, value);
  });
  for (const c of upstream.headers.getSetCookie()) out.append("set-cookie", c);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
