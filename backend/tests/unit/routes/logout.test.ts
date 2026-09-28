import "../helpers/vinxiHttpMock";
import { createStoredSession, fakeSessionRepository, sessionStore } from "../helpers/sessionStoreMock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUserIdFromEvent } from "~/lib/session";
import { POST } from "~/routes/api/auth/logout";
import { createMockEvent } from "../helpers/mockEvent";
import { getCookieValue } from "../helpers/vinxiHttpMock";

vi.mock("~/lib/neo4j", () => ({ getDriver: vi.fn(() => ({})) }));

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
  sessionStore.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const cookies = createStoredSession("u1");
    const event = createMockEvent({ method: "POST", cookies });

    const response = await POST(event);

    expect(response.status).toBe(200);
    expect(getCookieValue(event)).toBeUndefined();
    await expect(getUserIdFromEvent(createMockEvent({ cookies }))).resolves.toBeNull();
  });

  it("succeeds when there is no session cookie", async () => {
    const response = await POST(createMockEvent({ method: "POST" }));
    expect(response.status).toBe(200);
  });

  it("reports a failure to revoke but still clears the cookie", async () => {
    vi.spyOn(fakeSessionRepository, "deleteSession").mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const event = createMockEvent({ method: "POST", cookies: createStoredSession("u1") });

    const response = await POST(event);

    expect(response.status).toBe(500);
    expect(getCookieValue(event)).toBeUndefined();
  });
});
