import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
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
  const host =
    typeof values.ADMIN_HOST === "string"
      ? values.ADMIN_HOST.toLowerCase()
      : "";
  if (
    !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) ||
    host
      .split(".")
      .some(
        (label) =>
          !label ||
          label.length > 63 ||
          label.startsWith("-") ||
          label.endsWith("-"),
      )
  )
    throw new Error("ADMIN_HOST must be a bare DNS hostname.");
  values.ADMIN_HOST = host;
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

async function resolveRendererPath(root, supplied, output = false) {
  const segments = supplied.split("/");
  if (
    !segments.every(
      (segment) =>
        /^[A-Za-z0-9_.-]+$/.test(segment) &&
        segment !== "." &&
        segment !== ".." &&
        !segment.endsWith(".") &&
        !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment),
    )
  )
    throw new Error(
      "Renderer paths must be safe relative paths beneath the working directory.",
    );

  const filename = path.resolve(root, ...segments);
  const boundary = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!filename.startsWith(boundary))
    throw new Error(
      "Renderer paths must remain beneath the working directory.",
    );

  await Promise.all(
    segments.map(async (_, index) => {
      const entry = path.join(root, ...segments.slice(0, index + 1));
      try {
        const information = await lstat(entry);
        if (
          information.isSymbolicLink() ||
          (index < segments.length - 1 && !information.isDirectory()) ||
          (index === segments.length - 1 && !information.isFile())
        )
          throw new Error(
            "Renderer paths cannot use symbolic links or non-file inputs.",
          );
      } catch (error) {
        if (!output || error.code !== "ENOENT") throw error;
      }
    }),
  );
  return filename;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        template: { type: "string" },
        "config-file": { type: "string" },
        output: { type: "string" },
      },
    });
    if (!values.template || !values["config-file"] || !values.output)
      throw new Error(
        "Use --template RELATIVE_PATH --config-file RELATIVE_PATH --output RELATIVE_PATH.",
      );
    const root = await realpath(process.cwd());
    const [template, environment, output] = await Promise.all([
      resolveRendererPath(root, values.template),
      resolveRendererPath(root, values["config-file"]),
      resolveRendererPath(root, values.output, true),
    ]);
    const rendered = renderDeploymentTemplate(
      await readFile(template, "utf8"),
      parseEnv(await readFile(environment, "utf8")),
    );
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, rendered, { flag: "wx" });
    console.info("Admin Nginx configuration rendered.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
