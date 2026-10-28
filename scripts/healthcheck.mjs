import { fileURLToPath } from "node:url";

export async function checkHealth(
  target = "http://127.0.0.1/",
  expectedRelease,
) {
  const url = new URL(target);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Readiness target must be an HTTP(S) URL without credentials.",
    );
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
    const metadata = await fetch(new URL("_kernel/release", url), {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (
      metadata.status !== 200 ||
      (await metadata.json()).release !== expectedRelease
    )
      throw new Error("Unexpected deployed release.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 4) throw new Error("Unexpected arguments.");
    await checkHealth(process.argv[2], process.argv[3]);
  } catch {
    console.error("Admin readiness check failed.");
    process.exitCode = 1;
  }
}
