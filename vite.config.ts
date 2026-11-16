import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { srcPath } from "./tooling/paths.ts";

const repositoryRoot = fileURLToPath(new URL("./", import.meta.url));

const securityHeaders = (
  apiOrigin: string,
  assetOrigin: string,
  observabilityOrigin: string,
) => {
  const connectSources = ["'self'", apiOrigin, observabilityOrigin]
    .filter(Boolean)
    .join(" ");
  const imageSources = [
    "'self'",
    "data:",
    "blob:",
    apiOrigin,
    assetOrigin === apiOrigin ? "" : assetOrigin,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    "Content-Security-Policy": `default-src 'self'; base-uri 'self'; connect-src ${connectSources}; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src ${imageSources}; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'`,
    "Permissions-Policy":
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
};

export default defineConfig(({ mode }) => {
  // Isolated checks must not inspect the operator's local environment files.
  const synthetic = process.env.KERNEL_SYNTHETIC_ENV === "1";
  const env = {
    ...(synthetic ? {} : loadEnv(mode, repositoryRoot, "")),
    ...process.env,
  };
  const publicEnvironmentNames = [
    "VITE_API_BASE_URL",
    "VITE_APP_BASE_URL",
    "VITE_OBSERVABILITY_URL",
    "VITE_RELEASE_ID",
  ];
  const apiOrigin = new URL(env.VITE_API_BASE_URL || "http://localhost").origin;
  const assetOrigin = env.PUBLIC_ASSET_ORIGIN
    ? new URL(env.PUBLIC_ASSET_ORIGIN).origin
    : apiOrigin;
  const observabilityOrigin = env.VITE_OBSERVABILITY_URL
    ? new URL(env.VITE_OBSERVABILITY_URL).origin
    : "";

  return {
    base: env.VITE_APP_BASE_URL,
    define: Object.fromEntries(
      publicEnvironmentNames
        .filter((key) => env[key] !== undefined)
        .map((key) => [`import.meta.env.${key}`, JSON.stringify(env[key])]),
    ),
    envDir: synthetic ? false : repositoryRoot,
    envPrefix: [],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                entriesAware: true,
                name: "react",
                priority: 30,
                test: /node_modules[\\/](?:react|react-dom|react-router|scheduler)[\\/]/,
              },
              {
                entriesAware: true,
                maxSize: 450_000,
                name: "ui",
                priority: 20,
                test: /node_modules[\\/](?:@ant-design|@emotion|@rc-component|antd|antd-style|rc-[^\\/]+)[\\/]/,
              },
              {
                entriesAware: true,
                maxSize: 450_000,
                name: "vendor",
                priority: 10,
                test: /node_modules[\\/]/,
              },
            ],
          },
          strictExecutionOrder: true,
        },
      },
    },
    plugins: [react()],
    preview: {
      headers: securityHeaders(apiOrigin, assetOrigin, observabilityOrigin),
      host: "127.0.0.1",
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": srcPath,
      },
    },
    server: {
      allowedHosts: ["localhost"],
      host: "127.0.0.1",
    },
  };
});
