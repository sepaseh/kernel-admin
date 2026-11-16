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
  const { root } = await fixture();
  const openFile = fs.promises.open;
  let read = false;
  let closed = false;
  try {
    context.mock.method(fs.promises, "open", async (file, flags) => {
      const handle = await openFile(file, flags);
      if (!file.endsWith(path.join("_kernel", "build.json"))) return handle;

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

test("rejects an asset parent replaced before opening without reading its replacement", async (context) => {
  const { root } = await fixture();
  const outside = path.join(root, "outside");
  const openFile = fs.promises.open;
  let streamed = false;
  let closed = false;
  try {
    await mkdir(outside);
    await writeFile(
      path.join(outside, "app-hash.js"),
      "synthetic unrelated bytes",
    );
    context.mock.method(fs.promises, "open", async (file, flags) => {
      if (!file.endsWith(path.join("assets", "app-hash.js")))
        return openFile(file, flags);

      const assets = path.dirname(file);
      await rename(assets, path.join(root, "original-assets"));
      await symlink(
        outside,
        assets,
        process.platform === "win32" ? "junction" : "dir",
      );
      const handle = await openFile(file, flags);
      return {
        stat: (options) => handle.stat(options),
        createReadStream() {
          streamed = true;
          return handle.createReadStream({ autoClose: false });
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
      /asset identity changed/,
    );
    assert.equal(streamed, false);
    assert.equal(closed, true);
    await assert.rejects(
      readFile(
        path.join(root, "releases/synthetic-v1/public/assets/app-hash.js"),
      ),
      { code: "ENOENT" },
    );
    assert.equal(
      await readFile(path.join(outside, "app-hash.js"), "utf8"),
      "synthetic unrelated bytes",
    );
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await cleanup(root);
  }
});

test("copies assets from their validated handles after a pathname replacement", async (context) => {
  const { root, build } = await fixture();
  const openFile = fs.promises.open;
  let closed = false;
  try {
    context.mock.method(fs.promises, "open", async (file, flags) => {
      const handle = await openFile(file, flags);
      if (!file.endsWith(path.join("assets", "app-hash.js"))) return handle;

      return {
        stat: (options) => handle.stat(options),
        async close() {
          closed = true;
          await handle.close();
        },
        createReadStream(options) {
          fs.renameSync(file, `${file}.original`);
          fs.writeFileSync(file, "synthetic replacement");
          return handle.createReadStream(options);
        },
      };
    });
    syncBuiltinESMExports();
    const output = await packageRelease({
      repositoryRoot: root,
      releaseId: "synthetic-v1",
    });
    assert.equal(closed, true);
    assert.equal(
      await readFile(
        path.join(output.directory, "public/assets/app-hash.js"),
        "utf8",
      ),
      "export default 1;",
    );
    assert.equal(
      await readFile(path.join(build, "assets/app-hash.js"), "utf8"),
      "synthetic replacement",
    );
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await cleanup(root);
  }
});

test("preserves asset read and close failures and restores the build", async (context) => {
  const { root, build } = await fixture();
  const openFile = fs.promises.open;
  const readFailure = new Error("Synthetic asset read failure");
  const closeFailure = new Error("Synthetic asset close failure");
  try {
    context.mock.method(fs.promises, "open", async (file, flags) => {
      const handle = await openFile(file, flags);
      if (!file.endsWith(path.join("assets", "app-hash.js"))) return handle;

      return {
        stat: (options) => handle.stat(options),
        createReadStream(options) {
          const stream = handle.createReadStream(options);
          queueMicrotask(() => stream.destroy(readFailure));
          return stream;
        },
        async close() {
          await handle.close();
          throw closeFailure;
        },
      };
    });
    syncBuiltinESMExports();
    await assert.rejects(
      packageRelease({ repositoryRoot: root, releaseId: "synthetic-v1" }),
      (error) => {
        assert.deepEqual(error.errors, [readFailure, closeFailure]);
        assert.equal(error.cause, readFailure);
        return true;
      },
    );
    assert.equal(
      await readFile(path.join(build, "assets/app-hash.js"), "utf8"),
      "export default 1;",
    );
    assert.equal(
      (await readdir(root)).some((entry) =>
        entry.startsWith(".kernel-release-"),
      ),
      false,
    );
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await cleanup(root);
  }
});

test("bounds open source handles while packaging multiple assets", async (context) => {
  const { root, build } = await fixture();
  const openFile = fs.promises.open;
  let active = 0;
  let peak = 0;
  try {
    for (let index = 0; index < 8; index++)
      await writeFile(
        path.join(build, "assets", `chunk-${index}.js`),
        `export default ${index};`,
      );

    context.mock.method(fs.promises, "open", async (file, flags) => {
      const handle = await openFile(file, flags);
      if (path.basename(path.dirname(file)) !== "assets") return handle;

      peak = Math.max(peak, ++active);
      return {
        stat: (options) => handle.stat(options),
        createReadStream: (options) => handle.createReadStream(options),
        async close() {
          try {
            await handle.close();
          } finally {
            active--;
          }
        },
      };
    });
    syncBuiltinESMExports();
    const output = await packageRelease({
      repositoryRoot: root,
      releaseId: "synthetic-v1",
    });
    assert.equal(peak, 1);
    assert.equal(active, 0);
    assert.equal(
      (await readdir(path.join(output.directory, "public/assets"))).length,
      9,
    );
    assert.equal(
      await readFile(
        path.join(output.directory, "public/assets/chunk-7.js"),
        "utf8",
      ),
      "export default 7;",
    );
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await cleanup(root);
  }
});

test("rejects a replaced build root before reading any build files", async (context) => {
  const { root, build } = await fixture();
  const outside = path.join(root, "outside");
  const renameEntry = fs.promises.rename;
  const reads = [];
  try {
    await mkdir(outside);
    await writeFile(
      path.join(outside, "marker"),
      "synthetic unrelated directory",
    );
    context.mock.method(fs.promises, "rename", async (source, target) => {
      if (source === build) {
        await renameEntry(build, path.join(root, "original-build"));
        await symlink(
          outside,
          build,
          process.platform === "win32" ? "junction" : "dir",
        );
      }
      return renameEntry(source, target);
    });
    context.mock.method(fs.promises, "open", async (file) => {
      reads.push(file);
      throw new Error("Unexpected build read");
    });
    syncBuiltinESMExports();
    await assert.rejects(
      packageRelease({ repositoryRoot: root, releaseId: "synthetic-v1" }),
      /changed while acquiring/,
    );
    assert.deepEqual(reads, []);
    assert.deepEqual(await readdir(outside), ["marker"]);
    assert.equal(
      JSON.parse(
        await readFile(
          path.join(root, "original-build/_kernel/build.json"),
          "utf8",
        ),
      ).releaseId,
      "synthetic-v1",
    );
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
      if (!file.endsWith(path.join("_kernel", "build.json"))) return handle;

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
