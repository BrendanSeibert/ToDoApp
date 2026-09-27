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
});
