import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { checkHealth } from "./healthcheck.mjs";

test("readiness requires real HTML and matching immutable release, rejects redirects and errors", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/console/_kernel/release") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ release: "synthetic-v1" }));
      return;
    }
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/console/" });
      response.end();
      return;
    }
    response.setHeader(
      "Content-Type",
      request.url === "/console/" ? "text/html" : "application/json",
    );
    response.end(request.url === "/console/" ? "<html>synthetic</html>" : "{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    await checkHealth(`${origin}/console/`, "synthetic-v1");
    await assert.rejects(
      checkHealth(`${origin}/console/`, "wrong"),
      /Unexpected/,
    );
    await assert.rejects(checkHealth(`${origin}/invalid`), /not ready/);
    await assert.rejects(checkHealth(`${origin}/redirect`));
    await assert.rejects(checkHealth("file:///not-a-target"));
    await assert.rejects(checkHealth(null));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("readiness binds deep routes to an explicit same-origin application base before requests", async (context) => {
  const requests = [];
  const bases = ["/console/", "/team/admin/", "/"];
  const server = createServer((request, response) => {
    requests.push({ path: request.url, host: request.headers.host });
    if (bases.some((base) => request.url === `${base}_kernel/release`)) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ release: "synthetic-v1" }));
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end("<html>synthetic route</html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const [route, base] of [
      ["/console/auth/register", "/console/"],
      ["/console/auth/", "/console/"],
      ["/team/admin/users/42", "/team/admin/"],
      ["/auth/register", "/"],
      ["/console/", undefined],
    ]) {
      const before = requests.length;
      await checkHealth(`${origin}${route}`, "synthetic-v1", base);
      assert.deepEqual(requests.slice(before), [
        { path: route, host: new URL(origin).host },
        { path: `${base ?? route}_kernel/release`, host: new URL(origin).host },
      ]);
    }
    const beforeInvalid = requests.length;
    await assert.rejects(
      checkHealth(`${origin}/console/auth/register`, "synthetic-v1"),
      /Base path/,
    );
    await assert.rejects(
      checkHealth(
        `${origin}/console-other/auth/register`,
        "synthetic-v1",
        "/console/",
      ),
      /application base/,
    );
    await assert.rejects(
      checkHealth(
        `${origin.replace("://", "://user:pass@")}/console/`,
        "synthetic-v1",
        "/console/",
      ),
      /Readiness target/,
    );
    for (const suffix of ["?probe=1", "#client"])
      await assert.rejects(
        checkHealth(
          `${origin}/console/auth/register${suffix}`,
          "synthetic-v1",
          "/console/",
        ),
        /Readiness target/,
      );
    for (const base of [
      "/console",
      "/../",
      "//elsewhere.test/",
      "https://elsewhere.test/",
      "/console/?probe=1",
    ])
      await assert.rejects(
        checkHealth(`${origin}/console/auth/register`, "synthetic-v1", base),
        /Base path/,
      );
    assert.equal(requests.length, beforeInvalid);

    const defaults = [];
    context.mock.method(globalThis, "fetch", async (target) => {
      defaults.push(target.href);
      return new Response("<html>synthetic default</html>", {
        headers: { "Content-Type": "text/html" },
      });
    });
    await checkHealth();
    await assert.rejects(checkHealth(null));
    assert.deepEqual(defaults, ["http://127.0.0.1/"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("readiness rejects an explicitly empty release in the function and CLI before any request", async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    if (request.url === "/console/_kernel/release") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ release: "synthetic-v1" }));
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end("<html>synthetic readiness</html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const target = `http://127.0.0.1:${server.address().port}/console/`;
    const directError = await checkHealth(target, "").then(
      () => undefined,
      (error) => error,
    );
    const cliError = await promisify(execFile)(
      process.execPath,
      [
        fileURLToPath(new URL("./healthcheck.mjs", import.meta.url)),
        target,
        "",
      ],
      { windowsHide: true },
    ).then(
      () => undefined,
      (error) => error,
    );
    assert.deepEqual(
      requests,
      [],
      "neither empty release call may make a readiness request",
    );
    assert.match(
      directError?.message ?? "",
      /Expected release must not be empty/,
    );
    assert.equal(cliError?.code, 1);
    assert.match(cliError.stderr, /Admin readiness check failed/);

    await checkHealth(target);
    await checkHealth(target, "synthetic-v1");
    assert.deepEqual(requests, [
      "/console/",
      "/console/",
      "/console/_kernel/release",
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
