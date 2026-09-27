import "../helpers/vinxiHttpMock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "~/lib/auth";
import { getUserIdFromEvent } from "~/lib/session";
import { createMockEvent } from "../helpers/mockEvent";

vi.mock("~/lib/neo4j", () => ({ getDriver: vi.fn(() => ({})) }));
vi.mock("~/lib/repositories/userRepository", () => ({ createUserRepository: vi.fn() }));

import { createUserRepository } from "~/lib/repositories/userRepository";
import { DELETE, GET } from "~/routes/api/auth/me";

const mockedCreateUserRepository = createUserRepository as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
  mockedCreateUserRepository.mockReset();
});

describe("GET /api/auth/me", () => {
  it("returns 401 when not logged in", async () => {
    mockedCreateUserRepository.mockReturnValue({ findById: vi.fn() });
    const event = createMockEvent({});
    const response = await GET(event);
    expect(response.status).toBe(401);
  });

  it("returns the current user when logged in", async () => {
    mockedCreateUserRepository.mockReturnValue({
      findById: vi.fn().mockResolvedValue({ id: "u1", email: "a@example.com", createdAt: "now" }),
    });
    const event = createMockEvent({ cookies: { todo_session: createSessionToken("u1") } });
    const response = await GET(event);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "u1", email: "a@example.com", createdAt: "now" });
  });
});

describe("DELETE /api/auth/me", () => {
  it("returns 401 when not logged in", async () => {
    mockedCreateUserRepository.mockReturnValue({ deleteUser: vi.fn() });
    const event = createMockEvent({ method: "DELETE" });
    const response = await DELETE(event);
    expect(response.status).toBe(401);
  });

  it("deletes the account and clears the session cookie", async () => {
    const deleteUser = vi.fn().mockResolvedValue(undefined);
    mockedCreateUserRepository.mockReturnValue({ deleteUser });
    const event = createMockEvent({ method: "DELETE", cookies: { todo_session: createSessionToken("u1") } });
    const response = await DELETE(event);

    expect(response.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith("u1");
    expect(getUserIdFromEvent(event)).toBeNull();
  });
});
