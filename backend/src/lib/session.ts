import { deleteCookie, getCookie, setCookie } from "vinxi/http";
import type { APIEvent } from "@solidjs/start/server";
import { SESSION_COOKIE_NAME, createSessionToken, verifySessionToken } from "./auth";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export function setSessionCookie(event: APIEvent, userId: string): void {
  setCookie(event.nativeEvent, SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(event: APIEvent): void {
  deleteCookie(event.nativeEvent, SESSION_COOKIE_NAME, { path: "/" });
}

export function getUserIdFromEvent(event: APIEvent): string | null {
  const token = getCookie(event.nativeEvent, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
}

export function requireUserId(event: APIEvent): string {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}
