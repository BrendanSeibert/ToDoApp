import { createMiddleware } from "@solidjs/start/middleware";
import { getCorsHeaders } from "./lib/cors";

export default createMiddleware({
  onRequest: (event) => {
    if (event.request.method !== "OPTIONS") return;

    const corsHeaders = getCorsHeaders(event.request.headers.get("origin"));
    const headers = new Headers(corsHeaders ?? undefined);
    if (corsHeaders) {
      headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      // Let the browser reuse the preflight result. Chrome caps this at 7200 s; Firefox at 86400 s.
      headers.set("Access-Control-Max-Age", "7200");
    }
    return new Response(null, { status: 204, headers });
  },
});
