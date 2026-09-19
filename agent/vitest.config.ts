import { defineConfig } from "vitest/config";

export default defineConfig({
  css: { postcss: {} },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
