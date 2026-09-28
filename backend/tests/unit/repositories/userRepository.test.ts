import { describe, expect, it } from "vitest";
import { createUserRepository } from "~/lib/repositories/userRepository";
import { createMockDriver, fakeRecord } from "../helpers/mockDriver";

describe("userRepository", () => {
  it("createUser returns the created user's properties", async () => {
    const driver = createMockDriver((query) => {
      expect(query).toMatch(/CREATE \(u:User/);
      return {
        records: [
          fakeRecord({
            u: {
              properties: {
                id: "u1",
                email: "a@example.com",
                passwordHash: "hash",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            },
          }),
        ],
      };
    });

    const repo = createUserRepository(driver);
    const user = await repo.createUser("a@example.com", "hash");

    expect(user.email).toBe("a@example.com");
    expect(user.passwordHash).toBe("hash");
    expect(typeof user.id).toBe("string");
  });

  it("findByEmail returns null when no user matches", async () => {
    const driver = createMockDriver(() => ({ records: [] }));
    const repo = createUserRepository(driver);
    await expect(repo.findByEmail("missing@example.com")).resolves.toBeNull();
  });

  it("findByEmail returns the user when found", async () => {
    const driver = createMockDriver(() => ({
      records: [fakeRecord({ u: { properties: { id: "u1", email: "a@example.com" } } })],
    }));
    const repo = createUserRepository(driver);
    const user = await repo.findByEmail("a@example.com");
    expect(user?.id).toBe("u1");
  });

  it("findById returns null when no user matches", async () => {
    const driver = createMockDriver(() => ({ records: [] }));
    const repo = createUserRepository(driver);
    await expect(repo.findById("missing")).resolves.toBeNull();
  });

  it("deleteUser issues a DETACH DELETE for the user, owned todos, and sessions", async () => {
    let capturedQuery = "";
    const driver = createMockDriver((query) => {
      capturedQuery = query;
      return { records: [] };
    });
    const repo = createUserRepository(driver);
    await repo.deleteUser("u1");
    expect(capturedQuery).toMatch(/DETACH DELETE/);
    expect(capturedQuery).toMatch(/OWNS/);
    expect(capturedQuery).toMatch(/\[:HAS_SESSION\]->\(s:Session\)/);
    expect(capturedQuery).toMatch(/DETACH DELETE u, t, s/);
  });
});
