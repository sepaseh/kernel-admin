import { fileURLToPath } from "node:url";

import { validateBasePath } from "./validate-deployment-env.mjs";

export async function checkHealth(target, expectedRelease, basePath) {
  const url = new URL(target === undefined ? "http://127.0.0.1/" : target);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Readiness target must be an HTTP(S) URL without credentials, query or fragment.",
    );
  const applicationBase = basePath === undefined ? url.pathname : basePath;
  if (expectedRelease || basePath !== undefined) {
    validateBasePath(applicationBase);
    if (!url.pathname.startsWith(applicationBase))
      throw new Error(
        "Readiness target must remain inside its application base.",
      );
  }

  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (
    response.status !== 200 ||
    !response.headers.get("content-type")?.includes("text/html") ||
    !(await response.text()).toLowerCase().includes("<html")
  )
    throw new Error("Admin is not ready.");
  if (expectedRelease) {
    const metadata = await fetch(
      new URL(`${applicationBase}_kernel/release`, url.origin),
      {
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (
      metadata.status !== 200 ||
      (await metadata.json()).release !== expectedRelease
    )
      throw new Error("Unexpected deployed release.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 5) throw new Error("Unexpected arguments.");
    await checkHealth(process.argv[2], process.argv[3], process.argv[4]);
  } catch {
    console.error("Admin readiness check failed.");
    process.exitCode = 1;
  }
}
