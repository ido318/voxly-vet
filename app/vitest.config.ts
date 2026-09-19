import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["tests/setup.ts"],
    // Split into two projects so plain unit tests keep the lighter "node"
    // environment while React Testing Library component tests (*.test.tsx)
    // get a DOM via jsdom. Both extend the root config (aliases, setup file).
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/archive/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          exclude: ["tests/archive/**"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": appRoot,
    },
  },
});
