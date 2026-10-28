import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, parseEnv } from "node:util";

import {
  validateBasePath,
  validateOrigin,
  validateReleaseId,
} from "./validate-deployment-env.mjs";

export function renderDeploymentTemplate(template, environment) {
  const values = { HTTPS_PORT: "443", ...environment };
  if (
    !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(
      values.ADMIN_HOST ?? "",
    ) ||
    values.ADMIN_HOST.split(".").some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-"),
    )
  )
    throw new Error("ADMIN_HOST must be a bare DNS hostname.");
  validateOrigin(values.VITE_API_BASE_URL);
  validateBasePath(values.VITE_APP_BASE_URL);
  validateReleaseId(values.VITE_RELEASE_ID);
  validateOrigin(values.PUBLIC_ASSET_ORIGIN || values.VITE_API_BASE_URL);
  if (
    !/^\d+$/.test(values.HTTPS_PORT) ||
    Number(values.HTTPS_PORT) < 1 ||
    Number(values.HTTPS_PORT) > 65535
  )
    throw new Error("Invalid HTTPS_PORT.");
  for (const name of ["TLS_CERTIFICATE", "TLS_CERTIFICATE_KEY", "ADMIN_ROOT"])
    if (
      !/^\/[A-Za-z0-9_./-]+$/.test(values[name] ?? "") ||
      values[name].split("/").includes("..")
    )
      throw new Error(`Invalid ${name} path.`);
  values.PUBLIC_ASSET_ORIGIN ||= values.VITE_API_BASE_URL;
  values.CONNECT_SOURCES = values.VITE_API_BASE_URL;
  if (values.VITE_OBSERVABILITY_URL) {
    const endpoint = new URL(values.VITE_OBSERVABILITY_URL);
    validateOrigin(endpoint.origin);
    if (endpoint.username || endpoint.password || endpoint.hash)
      throw new Error("Invalid observability endpoint.");
    values.CONNECT_SOURCES += ` ${endpoint.origin}`;
  }
  values.ASSET_PREFIX = values.VITE_APP_BASE_URL;
  const allowed = new Set([
    "ADMIN_HOST",
    "HTTPS_PORT",
    "TLS_CERTIFICATE",
    "TLS_CERTIFICATE_KEY",
    "ADMIN_ROOT",
    "VITE_API_BASE_URL",
    "VITE_APP_BASE_URL",
    "VITE_RELEASE_ID",
    "PUBLIC_ASSET_ORIGIN",
    "ASSET_PREFIX",
    "CONNECT_SOURCES",
  ]);
  return template.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_, name) => {
    if (!allowed.has(name) || !values[name])
      throw new Error(`Unknown or unavailable public template field: ${name}.`);
    return values[name];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        template: { type: "string" },
        "env-file": { type: "string" },
        output: { type: "string" },
      },
    });
    if (!values.template || !values["env-file"] || !values.output)
      throw new Error("Use --template PATH --env-file PATH --output PATH.");
    const rendered = renderDeploymentTemplate(
      await readFile(values.template, "utf8"),
      parseEnv(await readFile(values["env-file"], "utf8")),
    );
    await mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
    await writeFile(values.output, rendered, { flag: "wx" });
    console.info("Admin Nginx configuration rendered.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
