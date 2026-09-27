import "../helpers/vinxiHttpMock";
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
  mockedCreateUserRepository.mockReset();
});

describe("POST /api/auth/login", () => {
  it("rejects a missing email or password", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn() });
    const event = createMockEvent({ method: "POST", body: { email: "", password: "" } });
    const response = await POST(event);
    expect(response.status).toBe(400);
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
    expect(getUserIdFromEvent(event)).toBe("u1");
  });
});
