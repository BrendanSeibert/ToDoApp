import { describe, expect, it } from "vitest";
import { ensureConstraints } from "~/lib/schema";
import { createMockDriver } from "../helpers/mockDriver";

describe("ensureConstraints", () => {
  it("creates each uniqueness constraint idempotently", async () => {
    const driver = createMockDriver(() => ({ records: [] }));

    await ensureConstraints(driver);

    const session = driver.session() as unknown as { run: { mock: { calls: [string][] } } };
    const statements = session.run.mock.calls.map(([query]) => query);
    expect(statements).toHaveLength(4);
    for (const name of ["user_email_unique", "user_id_unique", "todo_id_unique", "session_token_hash_unique"]) {
      expect(statements.some((query) => query.includes(name))).toBe(true);
    }
    for (const query of statements) {
      expect(query).toContain("IF NOT EXISTS");
    }
  });

  it("closes the session once on success", async () => {
    const driver = createMockDriver(() => ({ records: [] }));

    await ensureConstraints(driver);

    expect(driver.session().close).toHaveBeenCalledTimes(1);
  });

  it("propagates a failure and still closes the session", async () => {
    const failure = new Error("db down");
    const driver = createMockDriver(() => {
      throw failure;
    });

    await expect(ensureConstraints(driver)).rejects.toBe(failure);
    expect(driver.session().close).toHaveBeenCalledTimes(1);
  });
});
