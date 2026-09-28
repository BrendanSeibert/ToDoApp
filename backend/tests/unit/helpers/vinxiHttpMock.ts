import { vi } from "vitest";

interface FakeNativeEvent {
  __cookies: Record<string, string>;
  __cookieOptions?: Record<string, unknown>;
}

vi.mock("vinxi/http", () => ({
  getCookie: (event: FakeNativeEvent, name: string) => event.__cookies?.[name],
  setCookie: (event: FakeNativeEvent, name: string, value: string, options?: unknown) => {
    event.__cookies = event.__cookies ?? {};
    event.__cookies[name] = value;
    event.__cookieOptions = { ...event.__cookieOptions, [name]: options };
  },
  deleteCookie: (event: FakeNativeEvent, name: string) => {
    if (event.__cookies) delete event.__cookies[name];
  },
}));

export function getCookieValue(event: { nativeEvent: unknown }, name = "todo_session"): string | undefined {
  return (event.nativeEvent as FakeNativeEvent).__cookies?.[name];
}

export function getCookieOptions(event: { nativeEvent: unknown }, name = "todo_session"): unknown {
  return (event.nativeEvent as FakeNativeEvent).__cookieOptions?.[name];
}
