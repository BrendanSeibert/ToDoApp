// Everything environment-specific lives here, so tests never hard-code a URL.
// The defaults match docker-compose.e2e.yml.
export const config = {
  /** Where the browser loads the frontend. Must use "localhost" (see plan section 3.2). */
  baseUrl: process.env.E2E_BASE_URL ?? "http://localhost:5273",
  /** Where the backend is published. Used only for readiness checks. */
  apiUrl: process.env.E2E_API_URL ?? "http://localhost:3101",
  /** Show the browser window. */
  headed: process.env.HEADED === "1",
  /** Skip tests that are slow by nature (the 15-second message expiry). */
  skipSlow: process.env.E2E_SKIP_SLOW === "1",
  /** Default ceiling for an explicit wait, in milliseconds. */
  waitMs: 10_000,
};
