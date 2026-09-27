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
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "~": path.resolve(import.meta.dirname, "src"),
    },
  },
});
