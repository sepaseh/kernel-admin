import assert from "node:assert/strict";
import fs from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { packageRelease } from "./package-release.mjs";

const fixture = async (basePath = "/") => {
  const root = await mkdtemp(path.join(tmpdir(), "kernel-admin-package-"));
  const build = path.join(root, "dist");
  await mkdir(path.join(build, "_kernel"), { recursive: true });
  await mkdir(path.join(build, "assets"));
  await writeFile(
    path.join(build, "index.html"),
    `<html><script src="${basePath}assets/app-hash.js"></script></html>`,
  );
  await writeFile(path.join(build, "assets/app-hash.js"), "export default 1;");
  await writeFile(
    path.join(build, "_kernel/build.json"),
    JSON.stringify({
      releaseId: "synthetic-v1",
      basePath,
      apiOrigin: "https://api.example.com",
    }),
  );
  return { root, build };
};
const cleanup = async (root) => {
  assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
  assert.ok(path.basename(root).startsWith("kernel-admin-package-"));
  await rm(root, { recursive: true, force: true });
};

for (const basePath of ["/", "/console/", "/team/admin/"])
  test(`packages a static release with matching base path ${basePath}`, async () => {
    const { root } = await fixture(basePath);
    try {
      const output = await packageRelease({
        repositoryRoot: root,
        releaseId: "synthetic-v1",
      });
      assert.equal(output.directory, path.join(root, "releases/synthetic-v1"));
      assert.equal(
        (await readdir(path.join(root, "dist"))).includes("releases"),
        false,
      );
      assert.match(
        await readFile(
          path.join(
            output.directory,
            "public",
            basePath.slice(1),
            "index.html",
          ),
          "utf8",
        ),
        new RegExp(`${basePath}assets`),
      );
      assert.equal(
        JSON.parse(
          await readFile(
            path.join(
              output.directory,
              "public",
              basePath.slice(1),
              "_kernel/release.json",
            ),
            "utf8",
          ),
        ).release,
        "synthetic-v1",
      );
      await assert.rejects(
        packageRelease({ repositoryRoot: root, releaseId: "synthetic-v1" }),
        /EEXIST/,
      );
    } finally {
      await cleanup(root);
    }
  });

test("excludes credentials and refuses a stale build identity", async () => {
  const { root, build } = await fixture();
  try {
    await writeFile(
      path.join(build, ".env.local"),
      "synthetic private fixture",
    );
    await writeFile(path.join(build, "private.key"), "synthetic key");
    await assert.rejects(
      packageRelease({ repositoryRoot: root, releaseId: "other" }),
      /differs/,
    );
    const output = await packageRelease({
      repositoryRoot: root,
      releaseId: "synthetic-v1",
    });
    assert.equal(
      (await readdir(path.join(output.directory, "public"))).some(
        (name) => name.startsWith(".env") || name.endsWith(".key"),
      ),
      false,
    );
    for (const releaseId of ["../escape", "bad/id", "a..b", ""])
      await assert.rejects(
        packageRelease({ repositoryRoot: root, releaseId }),
        /release identifier/,
      );
  } finally {
    await cleanup(root);
  }
});

test("refuses directory links instead of following build content outside the tree", async () => {
  const { root, build } = await fixture();
  try {
    await mkdir(path.join(root, "outside"));
    await symlink(
      path.join(root, "outside"),
      path.join(build, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      packageRelease({ repositoryRoot: root, releaseId: "synthetic-v1" }),
      /symbolic links/,
    );
  } finally {
    await cleanup(root);
  }
});

test(
  "release output links fail before writes, including a link back into its own build",
  { timeout: 5000 },
  async (context) => {
    const { root, build } = await fixture();
    const writes = [];
    try {
      await symlink(
        build,
        path.join(root, "releases"),
        process.platform === "win32" ? "junction" : "dir",
      );
      context.mock.method(fs.promises, "mkdir", async (filename) => {
        writes.push(filename);
        throw new Error("Unexpected release write before output validation");
      });
      context.mock.method(fs.promises, "copyFile", async () => {
        throw new Error("Unexpected asset copy before output validation");
      });
      syncBuiltinESMExports();
      await assert.rejects(
        packageRelease({ repositoryRoot: root, releaseId: "synthetic-v1" }),
        /ordinary release directory/,
      );
      assert.deepEqual(writes, []);
    } finally {
      context.mock.restoreAll();
      syncBuiltinESMExports();
      await cleanup(root);
    }
  },
);
