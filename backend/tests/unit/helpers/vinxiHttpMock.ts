import { vi } from "vitest";

interface FakeNativeEvent {
  __cookies: Record<string, string>;
}

vi.mock("vinxi/http", () => ({
  getCookie: (event: FakeNativeEvent, name: string) => event.__cookies?.[name],
  setCookie: (event: FakeNativeEvent, name: string, value: string) => {
    event.__cookies = event.__cookies ?? {};
    event.__cookies[name] = value;
  },
  deleteCookie: (event: FakeNativeEvent, name: string) => {
    if (event.__cookies) delete event.__cookies[name];
  },
}));
