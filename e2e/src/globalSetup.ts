import { config } from "./config";

async function waitForUrl(url: string, timeoutMs: number, init?: RequestInit): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      // Any non-5xx response (even a 401) proves the server is up. A 5xx means the server is
      // answering but something behind it (usually the database) is not ready yet.
      const response = await fetch(url, init);
      if (response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`Timed out waiting for ${url}. Last error: ${String(lastError)}`);
}

export default async function setup(): Promise<void> {
  // A login attempt with unknown credentials makes the backend query Neo4j and then answer 401.
  // (GET /api/auth/me with no cookie answers 401 *before* touching the database, so it would
  // prove only that the HTTP server is up, not that the database connection works.)
  await waitForUrl(`${config.apiUrl}/api/auth/login`, 120_000, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "readiness-probe@example.com", password: "not-a-real-password" }),
  });
  await waitForUrl(config.baseUrl, 120_000);
}
