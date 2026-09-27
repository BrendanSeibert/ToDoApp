import "../helpers/vinxiHttpMock";
import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken } from "~/lib/auth";
import { getUserIdFromEvent } from "~/lib/session";
import { POST } from "~/routes/api/auth/logout";
import { createMockEvent } from "../helpers/mockEvent";

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const event = createMockEvent({ method: "POST", cookies: { todo_session: createSessionToken("u1") } });
    const response = await POST(event);
    expect(response.status).toBe(200);
    expect(getUserIdFromEvent(event)).toBeNull();
  });
});
