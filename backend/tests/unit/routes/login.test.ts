import "../helpers/vinxiHttpMock";
import { createStoredSession, sessionStore } from "../helpers/sessionStoreMock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEvent } from "../helpers/mockEvent";

vi.mock("~/lib/neo4j", () => ({ getDriver: vi.fn(() => ({})) }));
vi.mock("~/lib/repositories/userRepository", () => ({ createUserRepository: vi.fn() }));

import { createUserRepository } from "~/lib/repositories/userRepository";
import { hashPassword } from "~/lib/auth";
import { getUserIdFromEvent } from "~/lib/session";
import { POST } from "~/routes/api/auth/login";

const mockedCreateUserRepository = createUserRepository as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
  sessionStore.clear();
  mockedCreateUserRepository.mockReset();
});

describe("POST /api/auth/login", () => {
  it("rejects a missing email or password", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn() });
    const event = createMockEvent({ method: "POST", body: { email: "", password: "" } });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  it("rejects a body that is not valid JSON", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn() });
    const response = await POST(createMockEvent({ method: "POST", rawBody: "{not json" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Email and password are required" });
  });

  it.each([
    ["a numeric email", { email: 42, password: "password123" }],
    ["a null password", { email: "a@example.com", password: null }],
  ])("rejects %s", async (_label, body) => {
    const findByEmail = vi.fn();
    mockedCreateUserRepository.mockReturnValue({ findByEmail });
    const response = await POST(createMockEvent({ method: "POST", body }));

    expect(response.status).toBe(400);
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it("looks the user up by the trimmed, lower-cased email", async () => {
    const findByEmail = vi.fn().mockResolvedValue(null);
    mockedCreateUserRepository.mockReturnValue({ findByEmail });
    await POST(createMockEvent({ method: "POST", body: { email: "  A@Example.COM ", password: "whatever" } }));

    expect(findByEmail).toHaveBeenCalledWith("a@example.com");
  });

  it("rejects an unknown email with 401", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn().mockResolvedValue(null) });
    const event = createMockEvent({ method: "POST", body: { email: "a@example.com", password: "whatever" } });
    const response = await POST(event);
    expect(response.status).toBe(401);
  });

  it("rejects an incorrect password with 401", async () => {
    const passwordHash = await hashPassword("correct-password");
    mockedCreateUserRepository.mockReturnValue({
      findByEmail: vi.fn().mockResolvedValue({ id: "u1", email: "a@example.com", passwordHash }),
    });
    const event = createMockEvent({ method: "POST", body: { email: "a@example.com", password: "wrong-password" } });
    const response = await POST(event);
    expect(response.status).toBe(401);
  });

  it("logs in successfully and sets a session cookie", async () => {
    const passwordHash = await hashPassword("correct-password");
    mockedCreateUserRepository.mockReturnValue({
      findByEmail: vi.fn().mockResolvedValue({
        id: "u1",
        email: "a@example.com",
        passwordHash,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    });
    const event = createMockEvent({ method: "POST", body: { email: "a@example.com", password: "correct-password" } });
    const response = await POST(event);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "u1",
      email: "a@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await expect(getUserIdFromEvent(event)).resolves.toBe("u1");
  });

  it("does not create a session when login fails", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn().mockResolvedValue(null) });
    const event = createMockEvent({ method: "POST", body: { email: "a@example.com", password: "whatever" } });
    await POST(event);
    expect(sessionStore.size).toBe(0);
  });

  it("replaces the session the browser already carried", async () => {
    const passwordHash = await hashPassword("correct-password");
    mockedCreateUserRepository.mockReturnValue({
      findByEmail: vi.fn().mockResolvedValue({ id: "u1", email: "a@example.com", passwordHash, createdAt: "now" }),
    });
    const previous = createStoredSession("u1");
    const event = createMockEvent({
      method: "POST",
      body: { email: "a@example.com", password: "correct-password" },
      cookies: previous,
    });

    const response = await POST(event);

    expect(response.status).toBe(200);
    expect(sessionStore.size).toBe(1);
    await expect(getUserIdFromEvent(createMockEvent({ cookies: previous }))).resolves.toBeNull();
    await expect(getUserIdFromEvent(event)).resolves.toBe("u1");
  });
});
