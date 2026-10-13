import "../helpers/vinxiHttpMock";
import { createStoredSession, fakeSessionRepository, sessionStore } from "../helpers/sessionStoreMock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashSessionToken } from "~/lib/auth";
import {
  clearSessionCookie,
  endSession,
  getUserIdFromEvent,
  requireUserId,
  SESSION_TTL_SECONDS,
  startSession,
  UnauthorizedError,
} from "~/lib/session";
import { createMockEvent } from "../helpers/mockEvent";
import { getCookieOptions, getCookieValue } from "../helpers/vinxiHttpMock";

vi.mock("~/lib/neo4j", () => ({ getDriver: vi.fn(() => ({})) }));

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
  sessionStore.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getUserIdFromEvent", () => {
  it("returns the user id for a stored, unexpired session", async () => {
    const event = createMockEvent({ cookies: createStoredSession("user-123") });
    await expect(getUserIdFromEvent(event)).resolves.toBe("user-123");
  });

  it("returns null when there is no session cookie", async () => {
    await expect(getUserIdFromEvent(createMockEvent({}))).resolves.toBeNull();
  });

  it("returns null for a token with no stored session", async () => {
    const event = createMockEvent({ cookies: { todo_session: "not-a-real-session" } });
    await expect(getUserIdFromEvent(event)).resolves.toBeNull();
  });

  it("returns null for an expired session", async () => {
    const event = createMockEvent({ cookies: createStoredSession("user-123", { expired: true }) });
    await expect(getUserIdFromEvent(event)).resolves.toBeNull();
  });
});

describe("requireUserId", () => {
  it("returns the user id when authenticated", async () => {
    const event = createMockEvent({ cookies: createStoredSession("user-123") });
    await expect(requireUserId(event)).resolves.toBe("user-123");
  });

  it("throws UnauthorizedError when not authenticated", async () => {
    await expect(requireUserId(createMockEvent({}))).rejects.toThrow(UnauthorizedError);
  });
});

describe("startSession", () => {
  it("stores only the token's hash and sets the raw token as the cookie", async () => {
    const event = createMockEvent({});
    await startSession(event, "user-456");

    const token = getCookieValue(event)!;
    expect(token).toBeTruthy();
    expect(sessionStore.has(token)).toBe(false);
    expect(sessionStore.get(hashSessionToken(token))?.userId).toBe("user-456");
    await expect(getUserIdFromEvent(event)).resolves.toBe("user-456");
  });

  it("expires the session and the cookie after one day", async () => {
    const event = createMockEvent({});
    await startSession(event, "user-456");

    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24);
    expect(sessionStore.get(hashSessionToken(getCookieValue(event)!))?.ttlSeconds).toBe(SESSION_TTL_SECONDS);
    expect(getCookieOptions(event)).toMatchObject({ httpOnly: true, maxAge: SESSION_TTL_SECONDS });
  });

  it("scopes the cookie to the whole site and blocks cross-site sends", async () => {
    const event = createMockEvent({});
    await startSession(event, "user-456");

    expect(getCookieOptions(event)).toMatchObject({ path: "/", sameSite: "lax", httpOnly: true });
  });

  it("marks the cookie secure only in production", async () => {
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const production = createMockEvent({});
      await startSession(production, "user-456");
      expect(getCookieOptions(production)).toMatchObject({ secure: true });

      process.env.NODE_ENV = "development";
      const development = createMockEvent({});
      await startSession(development, "user-456");
      expect(getCookieOptions(development)).toMatchObject({ secure: false });
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("issues a different token for every session", async () => {
    const first = createMockEvent({});
    const second = createMockEvent({});
    await startSession(first, "user-456");
    await startSession(second, "user-456");

    expect(getCookieValue(first)).not.toBe(getCookieValue(second));
    expect(sessionStore.size).toBe(2);
  });

  it("revokes the session the client already carried", async () => {
    const previous = createStoredSession("someone-else");
    const event = createMockEvent({ cookies: previous });
    await startSession(event, "user-456");

    expect(sessionStore.has(hashSessionToken(previous.todo_session))).toBe(false);
    await expect(getUserIdFromEvent(createMockEvent({ cookies: previous }))).resolves.toBeNull();
  });

  it("fails without setting a cookie when the user doesn't exist", async () => {
    vi.spyOn(fakeSessionRepository, "createSession").mockResolvedValueOnce(false);
    const event = createMockEvent({});

    await expect(startSession(event, "missing-user")).rejects.toThrow();
    expect(getCookieValue(event)).toBeUndefined();
  });
});

describe("endSession", () => {
  it("revokes the stored session and clears the cookie", async () => {
    const cookies = createStoredSession("user-456");
    const event = createMockEvent({ cookies });
    await endSession(event);

    expect(sessionStore.size).toBe(0);
    expect(getCookieValue(event)).toBeUndefined();
    // Replaying the old cookie no longer authenticates.
    await expect(getUserIdFromEvent(createMockEvent({ cookies }))).resolves.toBeNull();
  });

  it("only revokes the current session, not the user's other sessions", async () => {
    const current = createStoredSession("user-456");
    const other = createStoredSession("user-456");
    await endSession(createMockEvent({ cookies: current }));

    await expect(getUserIdFromEvent(createMockEvent({ cookies: other }))).resolves.toBe("user-456");
  });

  it("still clears the cookie when revocation fails", async () => {
    vi.spyOn(fakeSessionRepository, "deleteSession").mockRejectedValueOnce(new Error("db down"));
    const event = createMockEvent({ cookies: createStoredSession("user-456") });

    await expect(endSession(event)).rejects.toThrow("db down");
    expect(getCookieValue(event)).toBeUndefined();
  });

  it("clears the cookie without a database call when there is no session cookie", async () => {
    const deleteSession = vi.spyOn(fakeSessionRepository, "deleteSession");
    await endSession(createMockEvent({}));
    expect(deleteSession).not.toHaveBeenCalled();
  });
});

describe("clearSessionCookie", () => {
  it("clears the session cookie", () => {
    const event = createMockEvent({ cookies: { todo_session: "some-token" } });
    clearSessionCookie(event);
    expect(getCookieValue(event)).toBeUndefined();
  });
});
