import bcrypt from "bcryptjs";
import { createHmac, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "todo_session";
const BCRYPT_ROUNDS = 10;
const SESSION_TOKEN_BYTES = 32;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: SESSION_SECRET");
  }
  return secret;
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

// The raw token only ever lives in the cookie; the database stores its hash.
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

// Keyed with SESSION_SECRET so stored hashes are useless without the secret,
// and rotating the secret invalidates every session.
export function hashSessionToken(token: string): string {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}
