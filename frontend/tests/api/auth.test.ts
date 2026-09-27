import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/api/client", async () => {
  const actual = await vi.importActual<typeof import("~/api/client")>("~/api/client");
  return { ...actual, apiRequest: vi.fn() };
});

import { apiRequest } from "~/api/client";
import { deleteAccount, getMe, login, logout, register } from "~/api/auth";

const mockedApiRequest = apiRequest as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe("auth api", () => {
  it("register posts email and password", async () => {
    mockedApiRequest.mockResolvedValue({ id: "u1", email: "a@example.com", createdAt: "now" });
    await register("a@example.com", "password123");
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com", password: "password123" }),
    });
  });

  it("login posts email and password", async () => {
    mockedApiRequest.mockResolvedValue({ id: "u1", email: "a@example.com", createdAt: "now" });
    await login("a@example.com", "password123");
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.com", password: "password123" }),
    });
  });

  it("logout posts with no body", async () => {
    mockedApiRequest.mockResolvedValue({ ok: true });
    await logout();
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("getMe issues a GET", async () => {
    mockedApiRequest.mockResolvedValue({ id: "u1", email: "a@example.com", createdAt: "now" });
    await getMe();
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/auth/me", { method: "GET" });
  });

  it("deleteAccount issues a DELETE", async () => {
    mockedApiRequest.mockResolvedValue({ ok: true });
    await deleteAccount();
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/auth/me", { method: "DELETE" });
  });
});
