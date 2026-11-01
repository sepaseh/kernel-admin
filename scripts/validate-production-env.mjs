import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

import { validateBasePath } from "./validate-deployment-env.mjs";
import { parseTarget } from "./validate-workflow-targets.mjs";

export const validateProductionEnv = (env) => {
  const apiUrl = env.VITE_API_BASE_URL;
  const appBaseUrl = env.VITE_APP_BASE_URL;
  const observabilityUrl = env.VITE_OBSERVABILITY_URL;
  if (!apiUrl) {
    throw new Error("VITE_API_BASE_URL is required for production builds");
  }

  parseTarget("VITE_API_BASE_URL", apiUrl);

  try {
    validateBasePath(appBaseUrl);
  } catch (error) {
    throw new Error(
      "VITE_APP_BASE_URL must start and end with / and use canonical URL segments in production",
      { cause: error },
    );
  }

  if (observabilityUrl) {
    parseTarget("VITE_OBSERVABILITY_URL", observabilityUrl);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
  validateProductionEnv(
    process.env.KERNEL_SYNTHETIC_ENV === "1"
      ? process.env
      : {
          ...loadEnv("production", repositoryRoot, ""),
          ...process.env,
        },
  );
}
