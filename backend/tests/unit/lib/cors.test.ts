import { describe, expect, it } from "vitest";
import { getCorsHeaders } from "~/lib/cors";

// Matches the default FRONTEND_ORIGIN fallback in ~/lib/cors (no env var set in this test run).
const ALLOWED_ORIGIN = "http://localhost:5173";

describe("getCorsHeaders", () => {
  it("returns allow-origin and allow-credentials for the allowed origin", () => {
    const headers = getCorsHeaders(ALLOWED_ORIGIN);
    expect(headers?.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(headers?.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("returns null for an unrecognized origin", () => {
    expect(getCorsHeaders("http://evil.example")).toBeNull();
  });

  it("returns null when there is no origin", () => {
    expect(getCorsHeaders(null)).toBeNull();
    expect(getCorsHeaders(undefined)).toBeNull();
  });
});
