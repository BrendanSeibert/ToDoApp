import { vi } from "vitest";
import { generateSessionToken, hashSessionToken } from "~/lib/auth";
import type { SessionRepository } from "~/lib/repositories/sessionRepository";

// In-memory stand-in for the Neo4j session store, keyed by token hash.
interface StoredSession {
  userId: string;
  ttlSeconds: number;
  expired: boolean;
}

export const sessionStore = new Map<string, StoredSession>();

// A single shared object, so tests can vi.spyOn its methods to simulate failures.
export const fakeSessionRepository: SessionRepository = {
  async createSession(userId, tokenHash, ttlSeconds) {
    sessionStore.set(tokenHash, { userId, ttlSeconds, expired: false });
    return true;
  },
  async findUserIdByTokenHash(tokenHash) {
    const session = sessionStore.get(tokenHash);
    return session && !session.expired ? session.userId : null;
  },
  async deleteSession(tokenHash) {
    sessionStore.delete(tokenHash);
  },
};

vi.mock("~/lib/repositories/sessionRepository", () => ({
  createSessionRepository: () => fakeSessionRepository,
}));

// Stores a session for `userId` and returns a cookie map carrying its raw token.
export function createStoredSession(userId: string, options: { expired?: boolean } = {}) {
  const token = generateSessionToken();
  sessionStore.set(hashSessionToken(token), { userId, ttlSeconds: 0, expired: options.expired ?? false });
  return { todo_session: token };
}
