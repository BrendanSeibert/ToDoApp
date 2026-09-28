import { beforeEach, describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
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
  it("generates distinct, URL-safe tokens with 256 bits of randomness", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSessionToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("hashes a token deterministically without exposing it", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken(token)).not.toBe(hashSessionToken(generateSessionToken()));
  });

  it("keys the hash with SESSION_SECRET, so rotating the secret changes every hash", () => {
    const token = generateSessionToken();
    const original = hashSessionToken(token);
    process.env.SESSION_SECRET = "a-different-secret";
    expect(hashSessionToken(token)).not.toBe(original);
  });

  it("refuses to hash without a SESSION_SECRET", () => {
    delete process.env.SESSION_SECRET;
    expect(() => hashSessionToken("anything")).toThrow("SESSION_SECRET");
  });
});
