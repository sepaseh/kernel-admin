import { fileURLToPath } from "node:url";

export function validateOrigin(value) {
  if (typeof value !== "string" || /[\\\s;"'{}<>`]/.test(value))
    throw new Error("Invalid public origin.");
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error(
      "An exact HTTPS origin is required (HTTP only on loopback).",
    );
  return url;
}

export function validateReleaseId(value) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) ||
    value.includes("..")
  )
    throw new Error("Invalid immutable release identifier.");
  return value;
}

export function validateBasePath(value) {
  if (typeof value !== "string" || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(value))
    throw new Error(
      "Base path must be / or slash-delimited URL segments ending in /.",
    );
  return value;
}

export function validateDeploymentEnv(environment = process.env) {
  validateOrigin(environment.VITE_API_BASE_URL);
  validateBasePath(environment.VITE_APP_BASE_URL);
  validateReleaseId(environment.VITE_RELEASE_ID);
  if (environment.VITE_OBSERVABILITY_URL) {
    const endpoint = new URL(environment.VITE_OBSERVABILITY_URL);
    validateOrigin(endpoint.origin);
    if (endpoint.username || endpoint.password || endpoint.hash)
      throw new Error("Invalid public observability URL.");
  }
  return {
    apiOrigin: environment.VITE_API_BASE_URL,
    basePath: environment.VITE_APP_BASE_URL,
    releaseId: environment.VITE_RELEASE_ID,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    validateDeploymentEnv();
    console.info("Public admin build configuration is valid.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
