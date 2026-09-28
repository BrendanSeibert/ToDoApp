import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { uniqueEmail, waitForBackend } from "./helpers/backend";
import { TestClient } from "./helpers/client";
import { closeTestDriver, expireSessions, getSessionTokenHashes } from "./helpers/db";

const password = "correct-horse-battery-staple";
const ONE_DAY_SECONDS = 60 * 60 * 24;

beforeAll(async () => {
  await waitForBackend();
}, 30000);

afterAll(async () => {
  await closeTestDriver();
});

async function registerNewUser(prefix: string) {
  const email = uniqueEmail(prefix);
  const client = new TestClient();
  const response = await client.post("/api/auth/register", { email, password });
  expect(response.status).toBe(201);
  return { email, client, response };
}

async function logIn(email: string) {
  const client = new TestClient();
  const response = await client.post("/api/auth/login", { email, password });
  expect(response.status).toBe(200);
  return client;
}

function tokenFrom(cookie: string | undefined): string {
  return cookie!.slice(cookie!.indexOf("=") + 1);
}

describe("server-side sessions", () => {
  it("issues an httpOnly cookie that expires after one day", async () => {
    const { client, response } = await registerNewUser("cookie");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`Max-Age=${ONE_DAY_SECONDS}(;|$)`));
    expect(setCookie).toMatch(/HttpOnly/i);

    await client.delete("/api/auth/me");
  });

  it("stores a keyed hash of the token, never the token itself", async () => {
    const { email, client } = await registerNewUser("hash");
    const token = tokenFrom(client.sessionCookie);

    const hashes = await getSessionTokenHashes(email);

    expect(hashes).toHaveLength(1);
    expect(hashes[0]).not.toContain(token);
    const expected = createHmac("sha256", process.env.SESSION_SECRET!).update(token).digest("hex");
    expect(hashes[0]).toBe(expected);

    await client.delete("/api/auth/me");
  });

  it("revokes the session on logout, so a replayed cookie is rejected", async () => {
    const { email, client } = await registerNewUser("logout");
    const captured = client.sessionCookie;

    expect((await client.post("/api/auth/logout")).status).toBe(200);

    const replay = new TestClient(captured);
    expect((await replay.get("/api/auth/me")).status).toBe(401);
    expect((await replay.get("/api/todos")).status).toBe(401);
    await expect(getSessionTokenHashes(email)).resolves.toEqual([]);

    await (await logIn(email)).delete("/api/auth/me");
  });

  it("gives each login its own session, and logout only ends that one", async () => {
    const { email, client: first } = await registerNewUser("multi");
    const second = await logIn(email);

    expect(first.sessionCookie).not.toBe(second.sessionCookie);
    await expect(getSessionTokenHashes(email)).resolves.toHaveLength(2);

    await first.post("/api/auth/logout");

    expect((await second.get("/api/auth/me")).status).toBe(200);
    await expect(getSessionTokenHashes(email)).resolves.toHaveLength(1);

    await second.delete("/api/auth/me");
  });

  it("revokes every session when the account is deleted", async () => {
    const { email, client: first } = await registerNewUser("delete");
    const second = await logIn(email);

    expect((await first.delete("/api/auth/me")).status).toBe(200);

    expect((await second.get("/api/auth/me")).status).toBe(401);
    // Previously a 500: the token still verified but the user was gone.
    expect((await second.post("/api/todos", { title: "Buy milk" })).status).toBe(401);
    await expect(getSessionTokenHashes(email)).resolves.toEqual([]);
  });

  it("rejects an expired session and prunes it on the next login", async () => {
    const { email, client } = await registerNewUser("expiry");

    await expireSessions(email);

    expect((await client.get("/api/auth/me")).status).toBe(401);
    expect((await client.get("/api/todos")).status).toBe(401);

    const fresh = await logIn(email);
    expect((await fresh.get("/api/auth/me")).status).toBe(200);
    await expect(getSessionTokenHashes(email)).resolves.toHaveLength(1);

    await fresh.delete("/api/auth/me");
  });
});
