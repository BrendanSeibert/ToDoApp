import { deleteCookie, getCookie, setCookie } from "vinxi/http";
import type { APIEvent } from "@solidjs/start/server";
import { SESSION_COOKIE_NAME, generateSessionToken, hashSessionToken } from "./auth";
import { getDriver } from "./neo4j";
import { createSessionRepository } from "./repositories/sessionRepository";

export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 1 day

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

function sessionRepository() {
  return createSessionRepository(getDriver());
}

function getSessionToken(event: APIEvent): string | undefined {
  return getCookie(event.nativeEvent, SESSION_COOKIE_NAME) || undefined;
}

export async function startSession(event: APIEvent, userId: string): Promise<void> {
  const repository = sessionRepository();

  // Revoke any session the client already carries, so a planted cookie can't outlive login.
  const previousToken = getSessionToken(event);
  if (previousToken) {
    await repository.deleteSession(hashSessionToken(previousToken));
  }

  const token = generateSessionToken();
  const created = await repository.createSession(userId, hashSessionToken(token), SESSION_TTL_SECONDS);
  if (!created) {
    throw new Error(`Cannot start a session for unknown user ${userId}`);
  }

  setCookie(event.nativeEvent, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(event: APIEvent): Promise<void> {
  const token = getSessionToken(event);
  try {
    if (token) {
      await sessionRepository().deleteSession(hashSessionToken(token));
    }
  } finally {
    // Clear the cookie even if revocation failed, so the browser is logged out regardless.
    clearSessionCookie(event);
  }
}

export function clearSessionCookie(event: APIEvent): void {
  deleteCookie(event.nativeEvent, SESSION_COOKIE_NAME, { path: "/" });
}

export async function getUserIdFromEvent(event: APIEvent): Promise<string | null> {
  const token = getSessionToken(event);
  if (!token) return null;
  return sessionRepository().findUserIdByTokenHash(hashSessionToken(token));
}

export async function requireUserId(event: APIEvent): Promise<string> {
  const userId = await getUserIdFromEvent(event);
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}
