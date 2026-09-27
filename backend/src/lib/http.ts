import type { APIEvent } from "@solidjs/start/server";
import { getCorsHeaders } from "./cors";
import { UnauthorizedError } from "./session";

export class ValidationError extends Error {}
export class AuthenticationError extends Error {}

export function json(data: unknown, status = 200, event?: APIEvent): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  const corsHeaders = getCorsHeaders(event?.request.headers.get("origin"));
  corsHeaders?.forEach((value, key) => headers.set(key, value));
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
