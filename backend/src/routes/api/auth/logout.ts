import type { APIEvent } from "@solidjs/start/server";
import { endSession } from "~/lib/session";
import { errorResponse, json } from "~/lib/http";

export async function POST(event: APIEvent): Promise<Response> {
  try {
    await endSession(event);
    return json({ ok: true }, 200, event);
  } catch (error) {
    return errorResponse(error, event);
  }
}
