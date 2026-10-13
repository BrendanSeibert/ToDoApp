export const TEST_PASSWORD = "correct-horse-battery"; // 8+ characters

/** A unique, lower-case email, so tests never depend on each other's data. */
export function uniqueEmail(label = "user"): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${label}-${Date.now()}-${random}@example.com`;
}
