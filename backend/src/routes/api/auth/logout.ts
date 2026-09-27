import type { APIEvent } from "@solidjs/start/server";
import { clearSessionCookie } from "~/lib/session";
import { json } from "~/lib/http";

export async function POST(event: APIEvent): Promise<Response> {
  clearSessionCookie(event);
  return json({ ok: true }, 200, event);
}
