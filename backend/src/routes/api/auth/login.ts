import type { APIEvent } from "@solidjs/start/server";
import { getDriver } from "~/lib/neo4j";
import { createUserRepository } from "~/lib/repositories/userRepository";
import { verifyPassword } from "~/lib/auth";
import { setSessionCookie } from "~/lib/session";
import { AuthenticationError, errorResponse, json, ValidationError } from "~/lib/http";

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const body = await event.request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    const userRepository = createUserRepository(getDriver());
    const user = await userRepository.findByEmail(email);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AuthenticationError("Invalid email or password");
    }

    setSessionCookie(event, user.id);

    return json({ id: user.id, email: user.email, createdAt: user.createdAt }, 200, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}
