import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import path from "node:path";

export default defineConfig({
  plugins: [solid({ hot: false })],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/index.tsx"],
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      thresholds: { statements: 97, branches: 94, functions: 98, lines: 97 },
    },
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "~": path.resolve(import.meta.dirname, "src"),
    },
  },
});
