import { describe, expect, it, vi } from "vitest";

// createMiddleware returns its options object, so the handler can be called directly.
vi.mock("@solidjs/start/middleware", () => ({
  createMiddleware: (options: unknown) => options,
}));

import middleware from "~/middleware";

// Matches the default FRONTEND_ORIGIN fallback in ~/lib/cors (no env var set in this test run).
const ALLOWED_ORIGIN = "http://localhost:5173";

function preflight(origin: string): Response {
  const request = new Request("http://api.test/api/todos", { method: "OPTIONS", headers: { origin } });
  const { onRequest } = middleware as unknown as { onRequest: (event: { request: Request }) => Response };
  return onRequest({ request });
}

describe("preflight middleware", () => {
  it("lets the browser cache the preflight for the allowed origin", () => {
    const response = preflight(ALLOWED_ORIGIN);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Max-Age")).toBe("7200");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
  });

  it("sends no CORS headers to another origin", () => {
    const response = preflight("http://evil.example");
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Max-Age")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
  });
});
