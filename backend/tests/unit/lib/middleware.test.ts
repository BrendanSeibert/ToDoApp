import { describe, expect, it, vi } from "vitest";

// createMiddleware returns its options object, so the handler can be called directly.
vi.mock("@solidjs/start/middleware", () => ({
  createMiddleware: (options: unknown) => options,
}));

import middleware from "~/middleware";

// Matches the default FRONTEND_ORIGIN fallback in ~/lib/cors (no env var set in this test run).
const ALLOWED_ORIGIN = "http://localhost:5173";

function handle(request: Request): Response | undefined {
  const { onRequest } = middleware as unknown as { onRequest: (event: { request: Request }) => Response | undefined };
  return onRequest({ request });
}

function preflight(origin: string): Response {
  return handle(
    new Request("http://api.test/api/todos", { method: "OPTIONS", headers: { origin } }),
  ) as Response;
}

describe("preflight middleware", () => {
  it("lets the browser cache the preflight for the allowed origin", () => {
    const response = preflight(ALLOWED_ORIGIN);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Max-Age")).toBe("7200");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
  });

  it("advertises the allowed methods, headers and credentials for the allowed origin", () => {
    const response = preflight(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PATCH, DELETE, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("lets non-preflight requests through untouched", () => {
    expect(handle(new Request("http://api.test/api/todos", { method: "GET" }))).toBeUndefined();
  });

  it("sends no CORS headers when the preflight has no Origin", () => {
    const response = handle(new Request("http://api.test/api/todos", { method: "OPTIONS" })) as Response;
    expect(response.status).toBe(204);
    expect([...response.headers.keys()].filter((name) => name.startsWith("access-control-"))).toEqual([]);
  });

  it("sends no CORS headers to another origin", () => {
    const response = preflight("http://evil.example");
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Max-Age")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
  });
});
