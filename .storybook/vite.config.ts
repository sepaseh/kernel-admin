import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  envDir: false,
  envPrefix: [],
  publicDir: false,
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/__storybook_api__"),
    "import.meta.env.VITE_OBSERVABILITY_URL": JSON.stringify(""),
    "import.meta.env.VITE_RELEASE_ID": JSON.stringify("synthetic-storybook"),
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  },
});
