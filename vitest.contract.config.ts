import { defineConfig } from "vitest/config";

import { srcPath } from "./tooling/paths.ts";

export default defineConfig({
  envDir: false,
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
  test: {
    env: {
      VITE_API_BASE_URL: "https://api.example.com",
      VITE_OBSERVABILITY_URL: "",
      VITE_RELEASE_ID: "synthetic-consumer-contract",
    },
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    include: ["contract/**/*.contract.test.ts"],
    pool: "forks",
    sequence: {
      concurrent: false,
    },
  },
});
