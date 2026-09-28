import { describe, expect, it } from "vitest";
import { createSessionRepository } from "~/lib/repositories/sessionRepository";
import { createMockDriver, fakeRecord } from "../helpers/mockDriver";

interface Captured {
  query: string;
  params: Record<string, unknown>;
}

function capturingDriver(records: unknown[] = []) {
  const captured: Captured = { query: "", params: {} };
  const driver = createMockDriver((query, params) => {
    captured.query = query;
    captured.params = params as Record<string, unknown>;
    return { records };
  });
  return { driver, captured };
}

describe("sessionRepository", () => {
  describe("createSession", () => {
    it("creates a session for the user with an expiry ttlSeconds from now", async () => {
      const { driver, captured } = capturingDriver([fakeRecord({ tokenHash: "hash-1" })]);
      const repo = createSessionRepository(driver);

      await expect(repo.createSession("u1", "hash-1", 86400)).resolves.toBe(true);

      expect(captured.query).toMatch(/MATCH \(u:User \{id: \$userId\}\)/);
      expect(captured.query).toMatch(/CREATE \(u\)-\[:HAS_SESSION\]->\(s:Session/);
      expect(captured.query).toMatch(/expiresAt: datetime\(\) \+ duration\(\{seconds: \$ttlSeconds\}\)/);
      expect(captured.params.userId).toBe("u1");
      expect(captured.params.tokenHash).toBe("hash-1");
      // Sent as a Neo4j integer, since duration() needs a whole number of seconds.
      expect((captured.params.ttlSeconds as { toNumber(): number }).toNumber()).toBe(86400);
    });

    it("prunes the user's expired sessions", async () => {
      const { driver, captured } = capturingDriver([fakeRecord({ tokenHash: "hash-1" })]);
      await createSessionRepository(driver).createSession("u1", "hash-1", 86400);

      expect(captured.query).toMatch(/WHERE expired\.expiresAt <= datetime\(\)\s+DETACH DELETE expired/);
    });

    it("returns false when the user doesn't exist", async () => {
      const { driver } = capturingDriver([]);
      await expect(createSessionRepository(driver).createSession("missing", "hash-1", 86400)).resolves.toBe(false);
    });

    it("never receives the raw token, only its hash", async () => {
      const { driver, captured } = capturingDriver([fakeRecord({ tokenHash: "hash-1" })]);
      await createSessionRepository(driver).createSession("u1", "hash-1", 86400);

      expect(Object.keys(captured.params).sort()).toEqual(["tokenHash", "ttlSeconds", "userId"]);
    });
  });

  describe("findUserIdByTokenHash", () => {
    it("returns the owning user's id for an unexpired session", async () => {
      const { driver, captured } = capturingDriver([fakeRecord({ userId: "u1" })]);

      await expect(createSessionRepository(driver).findUserIdByTokenHash("hash-1")).resolves.toBe("u1");

      expect(captured.query).toMatch(/\(u:User\)-\[:HAS_SESSION\]->\(s:Session \{tokenHash: \$tokenHash\}\)/);
      expect(captured.query).toMatch(/WHERE s\.expiresAt > datetime\(\)/);
      expect(captured.params).toEqual({ tokenHash: "hash-1" });
    });

    it("returns null when no live session matches", async () => {
      const { driver } = capturingDriver([]);
      await expect(createSessionRepository(driver).findUserIdByTokenHash("hash-1")).resolves.toBeNull();
    });
  });

  describe("deleteSession", () => {
    it("deletes the session with the given hash", async () => {
      const { driver, captured } = capturingDriver([]);

      await createSessionRepository(driver).deleteSession("hash-1");

      expect(captured.query).toMatch(/MATCH \(s:Session \{tokenHash: \$tokenHash\}\) DETACH DELETE s/);
      expect(captured.params).toEqual({ tokenHash: "hash-1" });
    });
  });

  it("closes the Neo4j session after each call", async () => {
    const { driver } = capturingDriver([]);
    const repo = createSessionRepository(driver);
    await repo.findUserIdByTokenHash("hash-1");
    await repo.deleteSession("hash-1");

    const neo4jSession = driver.session();
    expect(neo4jSession.close).toHaveBeenCalledTimes(2);
  });
});
