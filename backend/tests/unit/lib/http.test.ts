import { describe, expect, it, vi } from "vitest";
import { AuthenticationError, errorResponse, json, ValidationError } from "~/lib/http";
import { UnauthorizedError } from "~/lib/session";
import type { APIEvent } from "@solidjs/start/server";

// Matches the default FRONTEND_ORIGIN fallback in ~/lib/http (no env var set in this test run).
const ALLOWED_ORIGIN = "http://localhost:5173";

function eventWithOrigin(origin: string | null): APIEvent {
  return { request: new Request("http://localhost/api/test", { headers: origin ? { origin } : {} }) } as APIEvent;
}

describe("json", () => {
  it("serializes data with the given status and JSON content type", async () => {
    const response = json({ hello: "world" }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ hello: "world" });
  });

  it("defaults to status 200", () => {
    expect(json({}).status).toBe(200);
  });

  it("wires the allowed-origin CORS headers from ~/lib/cors into the response", () => {
    // Exhaustive origin-matching cases (unrecognized origin, no origin, etc.) live in cors.test.ts.
    const response = json({}, 200, eventWithOrigin(ALLOWED_ORIGIN));
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("omits CORS headers when no event is passed", () => {
    const response = json({});
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("errorResponse", () => {
  it("maps ValidationError to 400 with its message", async () => {
    const response = errorResponse(new ValidationError("bad input"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "bad input" });
  });

  it("maps AuthenticationError to 401 with its message", async () => {
    const response = errorResponse(new AuthenticationError("invalid credentials"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid credentials" });
  });

  it("maps UnauthorizedError to 401", async () => {
    const response = errorResponse(new UnauthorizedError());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("maps unknown errors to a generic 500 without leaking details", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = errorResponse(new Error("something exploded with secret detail"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
    consoleSpy.mockRestore();
  });
});
