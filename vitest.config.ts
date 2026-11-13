import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 35000,
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 3,
        minForks: 1,
      },
    },
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
