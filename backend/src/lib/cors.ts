const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

export function getCorsHeaders(origin: string | null | undefined): Headers | null {
  if (!origin || origin !== allowedOrigin) return null;

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  return headers;
}
