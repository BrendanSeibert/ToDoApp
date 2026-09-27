import { beforeEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "~/lib/auth";

beforeEach(() => {
  process.env.SESSION_SECRET = "unit-test-secret";
});

describe("password hashing", () => {
  it("hashes a password to a value different from the plaintext", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a valid token back to the same user id", () => {
    const token = createSessionToken("user-123");
    expect(verifySessionToken(token)).toBe("user-123");
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken("user-123");
    const tampered = token.replace("user-123", "user-456");
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken("user-123");
    process.env.SESSION_SECRET = "a-different-secret";
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("not-a-valid-token")).toBeNull();
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
  });
});
