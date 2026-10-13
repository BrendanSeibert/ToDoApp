import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/app.tsx",
        "src/entry-client.tsx",
        "src/entry-server.tsx",
        "src/routes/index.tsx",
      ],
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      thresholds: { statements: 98, branches: 95, functions: 98, lines: 98 },
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "src"),
    },
  },
});
