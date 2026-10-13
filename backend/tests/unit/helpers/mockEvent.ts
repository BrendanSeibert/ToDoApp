import type { APIEvent } from "@solidjs/start/server";

export function createMockEvent(options: {
  method?: string;
  body?: unknown;
  /** Sent as-is, for bodies that are not valid JSON. Takes precedence over `body`. */
  rawBody?: string;
  cookies?: Record<string, string>;
  params?: Record<string, string>;
}): APIEvent {
  const { method = "GET", body, rawBody, cookies = {}, params = {} } = options;

  const init: RequestInit = { method };
  if (rawBody !== undefined) {
    init.body = rawBody;
    init.headers = { "Content-Type": "application/json" };
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }

  return {
    request: new Request("http://localhost/api/test", init),
    response: { headers: new Headers() },
    nativeEvent: { __cookies: { ...cookies } } as unknown as APIEvent["nativeEvent"],
    params,
    locals: {},
  } as APIEvent;
}
