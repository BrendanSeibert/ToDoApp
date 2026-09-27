import type { APIEvent } from "@solidjs/start/server";
import { UnauthorizedError } from "./session";

export class ValidationError extends Error {}
export class AuthenticationError extends Error {}

const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

function addCorsHeaders(headers: Headers, event?: APIEvent): void {
  const origin = event?.request.headers.get("origin");
  if (!origin || origin !== allowedOrigin) return;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
}

export function json(data: unknown, status = 200, event?: APIEvent): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  addCorsHeaders(headers, event);
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(error: unknown, event?: APIEvent): Response {
  if (error instanceof ValidationError) {
    return json({ error: error.message }, 400, event);
  }
  if (error instanceof AuthenticationError) {
    return json({ error: error.message }, 401, event);
  }
  if (error instanceof UnauthorizedError) {
    return json({ error: "Unauthorized" }, 401, event);
  }
  console.error(error);
  return json({ error: "Internal server error" }, 500, event);
}
