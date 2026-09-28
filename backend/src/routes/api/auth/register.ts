import type { APIEvent } from "@solidjs/start/server";
import { getDriver } from "~/lib/neo4j";
import { createUserRepository } from "~/lib/repositories/userRepository";
import { hashPassword } from "~/lib/auth";
import { startSession } from "~/lib/session";
import { errorResponse, json, ValidationError } from "~/lib/http";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const body = await event.request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!EMAIL_REGEX.test(email)) {
      throw new ValidationError("A valid email is required");
    }
    if (password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    const userRepository = createUserRepository(getDriver());

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ValidationError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.createUser(email, passwordHash);

    await startSession(event, user.id);

    return json({ id: user.id, email: user.email, createdAt: user.createdAt }, 201, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}
