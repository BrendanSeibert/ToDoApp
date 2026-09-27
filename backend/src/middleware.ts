import { createMiddleware } from "@solidjs/start/middleware";

const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

export default createMiddleware({
  onRequest: (event) => {
    if (event.request.method !== "OPTIONS") return;

    const origin = event.request.headers.get("origin");
    const headers = new Headers();
    if (origin === allowedOrigin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
    }
    return new Response(null, { status: 204, headers });
  },
});
