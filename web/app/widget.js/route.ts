// Serves the embeddable loader with this deployment's URLs baked in at request time.
import { serverEnv } from "@/lib/env";
import { WIDGET_LOADER } from "@/lib/widget-loader.generated";

// Dynamic so the URLs come from the runtime environment; browsers and CDNs cache it via Cache-Control.
export const dynamic = "force-dynamic";

export function GET() {
  const body = WIDGET_LOADER.replace('"__PEAKCHAT_API__"', JSON.stringify(serverEnv.publicApiUrl)).replace(
    '"__PEAKCHAT_WEB__"',
    JSON.stringify(serverEnv.publicWebUrl),
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Short cache so loader fixes roll out quickly; the file is ~4 KB gzipped.
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
