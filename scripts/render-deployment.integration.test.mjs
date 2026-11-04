import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { environment } from "./deployment.test-support.mjs";

test("renderer CLI confines relative inputs and exclusive output to its ordinary working tree", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kernel-admin-renderer-"),
  );
  const root = path.join(directory, "workspace");
  const outside = path.join(directory, "outside");
  const renderer = fileURLToPath(
    new URL("./render-deployment.mjs", import.meta.url),
  );
  const execute = (patch = {}) =>
    spawnSync(
      process.execPath,
      [
        renderer,
        "--template",
        patch.template ?? "input/admin.conf.template",
        "--config-file",
        patch.environment ?? "input/public.env",
        "--output",
        patch.output ?? "output/admin.conf",
      ],
      { cwd: root, encoding: "utf8" },
    );
  try {
    await mkdir(path.join(root, "input"), { recursive: true });
    await mkdir(outside);
    await writeFile(
      path.join(root, "input/admin.conf.template"),
      "server_name ${ADMIN_HOST};",
    );
    const publicConfiguration = Object.entries(environment)
      .map(([name, value]) => `${name}=${value}`)
      .join("\n");
    await writeFile(path.join(root, "input/public.env"), publicConfiguration);
    await writeFile(path.join(outside, "public.env"), publicConfiguration);
    await writeFile(
      path.join(outside, "admin.conf.template"),
      "server_name ${ADMIN_HOST};",
    );
    await writeFile(path.join(outside, "existing.conf"), "outside sentinel");

    const result = execute();
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(path.join(root, "output/admin.conf"), "utf8"),
      "server_name admin.example.com;",
    );
    assert.notEqual(
      execute().status,
      0,
      "existing output must never be overwritten",
    );
    let attempt = 0;
    const outsideNames = {
      template: "admin.conf.template",
      environment: "public.env",
      output: "new-output.conf",
    };
    for (const field of ["template", "environment", "output"])
      for (const value of [
        `../outside/${outsideNames[field]}`,
        path.join(outside, outsideNames[field]),
        "input/../existing.conf",
        "input\\existing.conf",
        "NUL",
        "input//admin.conf",
      ]) {
        const rejection = execute({
          output: `output/rejected-${attempt++}.conf`,
          [field]: value,
        });
        assert.notEqual(rejection.status, 0, `${field}: ${value}`);
        assert.match(rejection.stderr, /Renderer paths/);
      }
    await assert.rejects(readFile(path.join(outside, "new-output.conf")), {
      code: "ENOENT",
    });
    assert.equal(
      await readFile(path.join(outside, "existing.conf"), "utf8"),
      "outside sentinel",
    );

    await symlink(
      outside,
      path.join(root, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    for (const field of ["template", "environment", "output"]) {
      const rejection = execute({
        output: `output/rejected-${attempt++}.conf`,
        [field]: `linked/${outsideNames[field]}`,
      });
      assert.notEqual(rejection.status, 0, `linked ${field}`);
      assert.match(rejection.stderr, /Renderer paths/);
    }
    await assert.rejects(readFile(path.join(outside, "new-output.conf")), {
      code: "ENOENT",
    });
    assert.equal(
      await readFile(path.join(outside, "existing.conf"), "utf8"),
      "outside sentinel",
    );
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("kernel-admin-renderer-"));
    await rm(directory, { recursive: true, force: true });
  }
});
