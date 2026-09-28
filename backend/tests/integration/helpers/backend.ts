export const BASE_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

export async function waitForBackend(): Promise<void> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) return;
    } catch {
      // backend not up yet, retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Backend at ${BASE_URL} did not become ready in time`);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}
