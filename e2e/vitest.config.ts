import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.e2e.test.ts"],
    globalSetup: ["./src/globalSetup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // One browser at a time at first. Tests use unique users, so parallel is possible later.
    fileParallelism: false,
    // No retries: a test that fails once is flaky and must be fixed (Step 11). A retry would
    // turn that failure into a silent pass. Only raise this for CI, and then report retried tests.
    retry: 0,
  },
});
