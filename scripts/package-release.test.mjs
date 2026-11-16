import assert from "node:assert/strict";
import fs from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { packageRelease } from "./package-release.mjs";

const fixture = async (basePath = "/", temporaryParent = tmpdir()) => {
  const root = await mkdtemp(
    path.join(await realpath(temporaryParent), "kernel-admin-package-"),
  );
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
const cleanup = async (root, temporaryParent = tmpdir()) => {
  assert.equal(
    path.dirname(path.resolve(root)),
    await realpath(temporaryParent),
  );
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
    await writeFile(
      path.join(build, "assets/private.key"),
      "synthetic nested key",
    );
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
    assert.equal(
      (await readdir(path.join(output.directory, "public/assets"))).includes(
        "private.key",
      ),
      false,
    );
    assert.equal(
      await readFile(
        path.join(output.directory, "public/assets/app-hash.js"),
        "utf8",
      ),
      "export default 1;",
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

test("refuses a linked metadata directory before opening build metadata", async () => {
  const { root, build } = await fixture();
  const metadata = path.join(build, "_kernel");
  const relocated = path.join(root, "relocated-metadata");
  try {
    await rename(metadata, relocated);
    await symlink(
      relocated,
      metadata,
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      packageRelease({ repositoryRoot: root, releaseId: "synthetic-v1" }),
      /metadata must remain inside/,
    );
    assert.deepEqual(await readdir(root), ["dist", "relocated-metadata"]);
  } finally {
    await cleanup(root);
  }
});

test("rejects metadata replaced before descriptor validation and closes the handle", async (context) => {
  const { root, build } = await fixture();
  const filename = path.join(build, "_kernel/build.json");
  const openFile = fs.promises.open;
  let read = false;
  let closed = false;
  try {
    context.mock.method(fs.promises, "open", async (file, flags) => {
      const handle = await openFile(file, flags);
      if (file !== filename) return handle;

      return {
        async stat(options) {
          const result = await handle.stat(options);
          await rename(file, `${file}.original`);
          await writeFile(file, "replacement metadata");
          return result;
        },
        async readFile() {
          read = true;
          return handle.readFile();
        },
        async close() {
          closed = true;
          await handle.close();
        },
      };
    });
    syncBuiltinESMExports();
    await assert.rejects(
      packageRelease({ repositoryRoot: root, releaseId: "synthetic-v1" }),
      /metadata must remain inside/,
    );
    assert.equal(read, false);
    assert.equal(closed, true);
    assert.deepEqual(await readdir(root), ["dist"]);
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await cleanup(root);
  }
});

test("packages the validated metadata bytes after a pathname replacement", async (context) => {
  const { root, build } = await fixture("/console/");
  const filename = path.join(build, "_kernel/build.json");
  const openFile = fs.promises.open;
  const original = await readFile(filename);
  const replacement = Buffer.from("replacement metadata");
  let closed = false;
  try {
    context.mock.method(fs.promises, "open", async (file, flags) => {
      const handle = await openFile(file, flags);
      if (file !== filename) return handle;

      return {
        stat: (options) => handle.stat(options),
        async readFile() {
          await rename(file, path.join(path.dirname(file), ".original"));
          await writeFile(file, replacement);
          return handle.readFile();
        },
        async close() {
          closed = true;
          await handle.close();
        },
      };
    });
    syncBuiltinESMExports();
    const output = await packageRelease({
      repositoryRoot: root,
      releaseId: "synthetic-v1",
    });
    assert.equal(closed, true);
    assert.deepEqual(await readFile(filename), replacement);
    assert.deepEqual(
      await readFile(
        path.join(output.directory, "public/console/_kernel/build.json"),
      ),
      original,
    );
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await cleanup(root);
  }
});

test("release output links fail before writes, including a link back into its own build", async (context) => {
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
});

test("canonicalizes an owned temporary-parent alias before packaging", async () => {
  const temporaryParent = await realpath(tmpdir());
  const container = await mkdtemp(
    path.join(temporaryParent, "kernel-package-parent-test-"),
  );
  const target = path.join(container, "target");
  const alias = path.join(container, "alias");
  let root;
  try {
    await mkdir(target);
    await symlink(
      target,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    ({ root } = await fixture("/", alias));
    assert.equal(path.dirname(root), await realpath(target));
    const output = await packageRelease({
      repositoryRoot: root,
      releaseId: "synthetic-v1",
    });
    assert.equal(output.directory, path.join(root, "releases/synthetic-v1"));
    assert.deepEqual(await readdir(target), [path.basename(root)]);
  } finally {
    try {
      if (root) await cleanup(root, target);
    } finally {
      assert.equal(path.dirname(container), temporaryParent);
      assert.ok(
        path.basename(container).startsWith("kernel-package-parent-test-"),
      );
      await rm(container, { recursive: true, force: true });
    }
  }
});
