import type { APIEvent } from "@solidjs/start/server";
import { getDriver } from "~/lib/neo4j";
import { createUserRepository } from "~/lib/repositories/userRepository";
import { clearSessionCookie, requireUserId } from "~/lib/session";
import { errorResponse, json } from "~/lib/http";

export async function GET(event: APIEvent): Promise<Response> {
  try {
    const userId = await requireUserId(event);
    const userRepository = createUserRepository(getDriver());
    const user = await userRepository.findById(userId);

    if (!user) {
      clearSessionCookie(event);
      return json({ error: "Unauthorized" }, 401, event);
    }

    return json({ id: user.id, email: user.email, createdAt: user.createdAt }, 200, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}

export async function DELETE(event: APIEvent): Promise<Response> {
  try {
    const userId = await requireUserId(event);
    const userRepository = createUserRepository(getDriver());
    await userRepository.deleteUser(userId);
    clearSessionCookie(event);
    return json({ ok: true }, 200, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}
