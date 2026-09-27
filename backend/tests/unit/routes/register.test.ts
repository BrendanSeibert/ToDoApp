import "../helpers/vinxiHttpMock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEvent } from "../helpers/mockEvent";

vi.mock("~/lib/neo4j", () => ({ getDriver: vi.fn(() => ({})) }));
vi.mock("~/lib/repositories/userRepository", () => ({ createUserRepository: vi.fn() }));

import { createUserRepository } from "~/lib/repositories/userRepository";
import { getUserIdFromEvent } from "~/lib/session";
import { POST } from "~/routes/api/auth/register";

const mockedCreateUserRepository = createUserRepository as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
  mockedCreateUserRepository.mockReset();
});

describe("POST /api/auth/register", () => {
  it("rejects an invalid email", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn(), createUser: vi.fn() });
    const event = createMockEvent({ method: "POST", body: { email: "not-an-email", password: "longenough" } });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  it("rejects a password shorter than 8 characters", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn(), createUser: vi.fn() });
    const event = createMockEvent({ method: "POST", body: { email: "a@example.com", password: "short" } });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    mockedCreateUserRepository.mockReturnValue({
      findByEmail: vi.fn().mockResolvedValue({ id: "existing", email: "a@example.com" }),
      createUser: vi.fn(),
    });
    const event = createMockEvent({ method: "POST", body: { email: "a@example.com", password: "longenough" } });
    const response = await POST(event);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "An account with this email already exists",
    });
  });

  it("creates the account, sets a session cookie, and returns the user", async () => {
    const createUser = vi.fn().mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockedCreateUserRepository.mockReturnValue({
      findByEmail: vi.fn().mockResolvedValue(null),
      createUser,
    });

    const event = createMockEvent({ method: "POST", body: { email: "A@Example.com", password: "longenough" } });
    const response = await POST(event);

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith("a@example.com", expect.any(String));
    await expect(response.json()).resolves.toEqual({
      id: "u1",
      email: "a@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(getUserIdFromEvent(event)).toBe("u1");
  });
});
