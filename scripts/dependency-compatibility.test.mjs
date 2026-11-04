import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

const root = fileURLToPath(new URL("../", import.meta.url));
const fromStryker = createRequire(import.meta.resolve("@stryker-mutator/core"));
const fromRestClient = createRequire(
  fromStryker.resolve("typed-rest-client/RestClient.js"),
);

test("the patched matcher preserves TypeScript lint file selection", async () => {
  const eslint = new ESLint({ cwd: root });
  const [valid] = await eslint.lintText("export const answer: number = 42;\n", {
    filePath: "src/dependency-fixture.ts",
  });
  assert.equal(valid.errorCount, 0);
  const [invalid] = await eslint.lintText("const unused: number = 42;\n", {
    filePath: "src/dependency-fixture.ts",
  });
  assert.ok(
    invalid.messages.some(
      ({ ruleId }) => ruleId === "@typescript-eslint/no-unused-vars",
    ),
  );
});

test("the patched glob preserves both consumers' file discovery and cancellation", async (context) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "kernel-admin-dependency-"),
  );
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "nested"));
  await Promise.all(
    ["Button.tsx", "nested/types.ts", "nested/types.test.ts", "notes.md"].map(
      (file) =>
        writeFile(
          path.join(directory, file),
          "// synthetic dependency fixture\n",
        ),
    ),
  );
  const expected = [
    path.join(directory, "Button.tsx"),
    path.join(directory, "nested/types.ts"),
  ].sort();
  for (const consumer of [
    "@joshwooding/vite-plugin-react-docgen-typescript",
    "@sentry/bundler-plugins/core",
  ]) {
    const fromConsumer = createRequire(import.meta.resolve(consumer));
    const glob = fromConsumer("glob");
    const options = {
      cwd: directory,
      absolute: true,
      nodir: true,
      ignore: "**/*.test.ts",
    };
    assert.deepEqual(
      glob.globSync("**/*.{ts,tsx}", options).sort(),
      expected,
      consumer,
    );
    assert.deepEqual(
      (await glob.glob("**/*.{ts,tsx}", options)).sort(),
      expected,
      consumer,
    );
    const controller = new AbortController();
    controller.abort(new Error("synthetic cancellation"));
    await assert.rejects(
      glob.glob("**/*", { ...options, signal: controller.signal }),
      /synthetic cancellation/,
    );
  }
});

test("the patched qs resolves from typed-rest-client and preserves query serialization", () => {
  const qs = fromRestClient("qs");
  assert.equal(fromRestClient("qs/package.json").version, "6.17.1");
  assert.equal(
    qs.stringify(
      {
        search: "Ada & Co",
        tag: ["open", "ready"],
        filter: { active: true },
        page: 0,
      },
      { arrayFormat: "repeat", encodeValuesOnly: true },
    ),
    "search=Ada%20%26%20Co&tag=open&tag=ready&filter[active]=true&page=0",
  );
});

test("the consumer's qs safely serializes non-callable toString in both comma paths", () => {
  const qs = fromRestClient("qs");
  const input = JSON.parse('{"a":[{"toString":"x"}]}');
  for (const encodeValuesOnly of [false, true]) {
    assert.equal(
      qs.stringify(input, { arrayFormat: "comma", encodeValuesOnly }),
      "a=%5Bobject%20Object%5D",
    );
  }
  assert.deepEqual(input, { a: [{ toString: "x" }] });
});

test("RestClient sends normal and hardened comma queries to an owned loopback server", async (context) => {
  const { RestClient } = fromRestClient("./RestClient.js");
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ url: request.url }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
  const client = new RestClient(
    "synthetic-dependency-fixture",
    `http://127.0.0.1:${server.address().port}`,
    [],
    {
      allowRedirects: false,
      keepAlive: false,
      proxy: { proxyUrl: "" },
    },
  );
  context.after(() => client.client.dispose());

  const normal = await client.get("/search", {
    queryParameters: {
      params: { search: "Ada & Co", tag: ["open", "ready"], page: 0 },
    },
  });
  assert.equal(normal.statusCode, 200);
  assert.deepEqual(normal.result, {
    url: "/search?search=Ada%20%26%20Co&tag=open&tag=ready&page=0",
  });

  const hardened = await client.get("/search", {
    queryParameters: {
      options: { arrayFormat: "comma" },
      params: JSON.parse('{"a":[{"toString":"x"}]}'),
    },
  });
  assert.equal(hardened.statusCode, 200);
  assert.deepEqual(hardened.result, {
    url: "/search?a=%5Bobject%20Object%5D",
  });
});
