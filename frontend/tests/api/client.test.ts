import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiError } from "~/api/client";

describe("apiRequest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on a successful response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 200 }),
    );

    const result = await apiRequest<{ hello: string }>("/api/whatever");
    expect(result).toEqual({ hello: "world" });
  });

  it("sends credentials so session cookies are included", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response("{}", { status: 200 }));

    await apiRequest("/api/whatever");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/whatever"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("throws an ApiError with the server's message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), { status: 400 }),
    );

    await expect(apiRequest("/api/whatever")).rejects.toMatchObject({
      status: 400,
      message: "nope",
    });
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response("not json", { status: 500 }));

    await expect(apiRequest("/api/whatever")).rejects.toBeInstanceOf(ApiError);
  });

  it("uses 'Request failed' as the message when the error body has none", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response("not json", { status: 500 }));

    await expect(apiRequest("/api/whatever")).rejects.toMatchObject({ status: 500, message: "Request failed" });
  });

  it("returns null for a successful response whose body isn't JSON", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(apiRequest("/api/whatever")).resolves.toBeNull();
  });

  describe("headers", () => {
    const sentHeaders = () => (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Record<string, string>;

    beforeEach(() => {
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => new Response("{}", { status: 200 }));
    });

    it("sends a JSON content type when there is a body", async () => {
      await apiRequest("/x", { method: "POST", body: JSON.stringify({ a: 1 }) });

      expect(sentHeaders()).toMatchObject({ "Content-Type": "application/json" });
    });

    it("sends no content type when there is no body", async () => {
      await apiRequest("/x");

      expect(sentHeaders()).not.toHaveProperty("Content-Type");
    });

    it("lets the caller's headers win", async () => {
      await apiRequest("/x", { method: "POST", body: "hi", headers: { "Content-Type": "text/plain" } });

      expect(sentHeaders()).toMatchObject({ "Content-Type": "text/plain" });
    });
  });

  describe("base URL", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("defaults to http://localhost:3000 when VITE_API_URL is not set", async () => {
      vi.stubEnv("VITE_API_URL", undefined);
      vi.resetModules();
      const { apiRequest: freshApiRequest } = await import("~/api/client");
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response("{}", { status: 200 }));

      await freshApiRequest("/x");

      expect(fetch).toHaveBeenCalledWith("http://localhost:3000/x", expect.anything());
    });
  });
});
