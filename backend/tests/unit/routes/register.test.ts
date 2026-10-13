import "../helpers/vinxiHttpMock";
import { sessionStore } from "../helpers/sessionStoreMock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEvent } from "../helpers/mockEvent";

vi.mock("~/lib/neo4j", () => ({ getDriver: vi.fn(() => ({})) }));
vi.mock("~/lib/repositories/userRepository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/repositories/userRepository")>()),
  createUserRepository: vi.fn(),
}));

import { createUserRepository, EmailAlreadyExistsError } from "~/lib/repositories/userRepository";
import { getUserIdFromEvent } from "~/lib/session";
import { POST } from "~/routes/api/auth/register";

const mockedCreateUserRepository = createUserRepository as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
  sessionStore.clear();
  mockedCreateUserRepository.mockReset();
});

describe("POST /api/auth/register", () => {
  it("rejects an invalid email", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn(), createUser: vi.fn() });
    const event = createMockEvent({ method: "POST", body: { email: "not-an-email", password: "longenough" } });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  it("rejects a body that is not valid JSON", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn(), createUser: vi.fn() });
    const response = await POST(createMockEvent({ method: "POST", rawBody: "{not json" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "A valid email is required" });
  });

  it.each([
    ["a numeric email", { email: 42, password: "longenough" }],
    ["a null email", { email: null, password: "longenough" }],
  ])("rejects %s", async (_label, body) => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn(), createUser: vi.fn() });
    const response = await POST(createMockEvent({ method: "POST", body }));

    expect(response.status).toBe(400);
  });

  it("rejects a non-string password", async () => {
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn(), createUser: vi.fn() });
    const response = await POST(createMockEvent({ method: "POST", body: { email: "a@example.com", password: 12345678 } }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Password must be at least 8 characters" });
  });

  it("rejects a 7 character password but accepts exactly 8", async () => {
    const createUser = vi.fn().mockResolvedValue({ id: "u1", email: "a@example.com", createdAt: "now" });
    mockedCreateUserRepository.mockReturnValue({ findByEmail: vi.fn().mockResolvedValue(null), createUser });

    const tooShort = await POST(createMockEvent({ method: "POST", body: { email: "a@example.com", password: "1234567" } }));
    expect(tooShort.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();

    const justEnough = await POST(createMockEvent({ method: "POST", body: { email: "a@example.com", password: "12345678" } }));
    expect(justEnough.status).toBe(201);
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

  it("rejects with the same 400 when a concurrent registration wins the race to create the user", async () => {
    mockedCreateUserRepository.mockReturnValue({
      findByEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockRejectedValue(new EmailAlreadyExistsError()),
    });
    const event = createMockEvent({ method: "POST", body: { email: "a@example.com", password: "longenough" } });

    const response = await POST(event);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "An account with this email already exists",
    });
    await expect(getUserIdFromEvent(event)).resolves.toBeNull();
  });

  it("still returns a 500 for an unexpected createUser failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedCreateUserRepository.mockReturnValue({
      findByEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockRejectedValue(new Error("connection lost")),
    });
    const event = createMockEvent({ method: "POST", body: { email: "a@example.com", password: "longenough" } });

    const response = await POST(event);

    expect(response.status).toBe(500);
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
    await expect(getUserIdFromEvent(event)).resolves.toBe("u1");
  });
});
