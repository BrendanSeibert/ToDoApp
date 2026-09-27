import "../helpers/vinxiHttpMock";
import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken } from "~/lib/auth";
import {
  clearSessionCookie,
  getUserIdFromEvent,
  requireUserId,
  setSessionCookie,
  UnauthorizedError,
} from "~/lib/session";
import { createMockEvent } from "../helpers/mockEvent";

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
});

describe("getUserIdFromEvent", () => {
  it("returns the user id for a valid session cookie", () => {
    const token = createSessionToken("user-123");
    const event = createMockEvent({ cookies: { todo_session: token } });
    expect(getUserIdFromEvent(event)).toBe("user-123");
  });

  it("returns null when there is no session cookie", () => {
    const event = createMockEvent({});
    expect(getUserIdFromEvent(event)).toBeNull();
  });
});

describe("requireUserId", () => {
  it("returns the user id when authenticated", () => {
    const token = createSessionToken("user-123");
    const event = createMockEvent({ cookies: { todo_session: token } });
    expect(requireUserId(event)).toBe("user-123");
  });

  it("throws UnauthorizedError when not authenticated", () => {
    const event = createMockEvent({});
    expect(() => requireUserId(event)).toThrow(UnauthorizedError);
  });
});

describe("setSessionCookie / clearSessionCookie", () => {
  it("sets a cookie that getUserIdFromEvent can then read", () => {
    const event = createMockEvent({});
    setSessionCookie(event, "user-456");
    expect(getUserIdFromEvent(event)).toBe("user-456");
  });

  it("clears the session cookie", () => {
    const event = createMockEvent({ cookies: { todo_session: createSessionToken("user-456") } });
    clearSessionCookie(event);
    expect(getUserIdFromEvent(event)).toBeNull();
  });
});
