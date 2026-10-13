import { describe, expect, it } from "vitest";
import { Neo4jError } from "neo4j-driver";
import { createUserRepository, EmailAlreadyExistsError } from "~/lib/repositories/userRepository";
import { createMockDriver, fakeRecord } from "../helpers/mockDriver";

// The driver's constructor also wants GQL status fields, which these tests don't care about.
const neo4jError = (message: string, code: string) => new Neo4jError(message, code, "50N42", "error: general processing exception");

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

  describe("createUser constraint violations", () => {
    const CONSTRAINT_CODE = "Neo.ClientError.Schema.ConstraintValidationFailed";
    const rejectingDriver = (error: Error) =>
      createMockDriver(() => {
        throw error;
      });

    it("throws EmailAlreadyExistsError when the email uniqueness constraint fails", async () => {
      const driver = rejectingDriver(
        neo4jError("Node(1) already exists with label `User` and property `email` = 'a@example.com'", CONSTRAINT_CODE),
      );

      await expect(createUserRepository(driver).createUser("a@example.com", "hash")).rejects.toBeInstanceOf(
        EmailAlreadyExistsError,
      );
    });

    it("rethrows a constraint violation on a different property", async () => {
      const error = neo4jError("Node(1) already exists with label `User` and property `id` = 'x'", CONSTRAINT_CODE);

      await expect(createUserRepository(rejectingDriver(error)).createUser("a@example.com", "hash")).rejects.toBe(
        error,
      );
    });

    it("rethrows other database errors unchanged", async () => {
      const error = neo4jError("Connection refused", "ServiceUnavailable");

      await expect(createUserRepository(rejectingDriver(error)).createUser("a@example.com", "hash")).rejects.toBe(
        error,
      );
    });

    it("closes the session when the create fails", async () => {
      const driver = rejectingDriver(neo4jError("`email`", CONSTRAINT_CODE));

      await createUserRepository(driver).createUser("a@example.com", "hash").catch(() => undefined);

      expect(driver.session().close).toHaveBeenCalled();
    });
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

  it("findById returns the user's properties when found and closes the session", async () => {
    const driver = createMockDriver(() => ({
      records: [fakeRecord({ u: { properties: { id: "u1", email: "a@example.com" } } })],
    }));

    await expect(createUserRepository(driver).findById("u1")).resolves.toEqual({
      id: "u1",
      email: "a@example.com",
    });
    expect(driver.session().close).toHaveBeenCalledTimes(1);
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
