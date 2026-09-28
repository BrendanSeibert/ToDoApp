import { BASE_URL } from "./backend";

export class TestClient {
  // Pass a cookie captured from another client to replay its session.
  constructor(private cookie?: string) {}

  get sessionCookie(): string | undefined {
    return this.cookie;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("Cookie", this.cookie);

    const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }

    return response;
  }

  get(path: string) {
    return this.request(path, { method: "GET" });
  }

  post(path: string, body?: unknown) {
    return this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch(path: string, body?: unknown) {
    return this.request(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete(path: string) {
    return this.request(path, { method: "DELETE" });
  }

  clearCookie() {
    this.cookie = undefined;
  }
}
