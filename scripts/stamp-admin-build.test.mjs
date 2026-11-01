import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createBuildMetadata, stampAdminBuild } from "./stamp-admin-build.mjs";

const publicBuildEnvironment = {
  VITE_API_BASE_URL: "https://api.example.com",
  VITE_APP_BASE_URL: "/console/",
  VITE_RELEASE_ID: "synthetic-v1",
};
const buildFixture = async (temporaryParent = tmpdir()) => {
  const temporaryRoot = await realpath(temporaryParent);
  const root = await mkdtemp(
    path.join(temporaryRoot, "kernel-build-stamp-test-"),
  );
  const build = path.join(root, "dist");
  await mkdir(build);
  await writeFile(
    path.join(build, "index.html"),
    "<html>synthetic completed build</html>",
  );
  return {
    root,
    build,
    cleanup: async () => {
      expect(path.dirname(path.resolve(root))).toBe(temporaryRoot);
      expect(path.basename(root).startsWith("kernel-build-stamp-test-")).toBe(
        true,
      );
      await rm(root, { recursive: true, force: true });
    },
  };
};

describe("validated build metadata", () => {
  it("keeps sibling ownership when the temporary parent is an alias", async () => {
    const temporaryParent = await realpath(tmpdir());
    const root = await mkdtemp(
      path.join(temporaryParent, "kernel-build-parent-test-"),
    );
    const target = path.join(root, "target");
    const alias = path.join(root, "alias");
    let fixture;
    try {
      await mkdir(target);
      await symlink(
        target,
        alias,
        process.platform === "win32" ? "junction" : "dir",
      );
      fixture = await buildFixture(alias);
      const canonicalParent = await realpath(target);
      expect(path.dirname(fixture.root)).toBe(canonicalParent);
      const metadata = await stampAdminBuild({
        environment: publicBuildEnvironment,
        buildDirectory: fixture.build,
        openFile: async (file, flags) => {
          expect(path.dirname(path.dirname(path.dirname(file)))).toBe(
            fixture.root,
          );
          expect(path.relative(fixture.build, file).split(path.sep)[0]).toBe(
            "..",
          );
          expect(flags).toBe("wx");
          return open(file, flags);
        },
      });
      expect(metadata).toEqual(createBuildMetadata(publicBuildEnvironment));
      expect(await readdir(target)).toEqual([path.basename(fixture.root)]);
    } finally {
      if (fixture) await fixture.cleanup();
      expect(path.dirname(root)).toBe(temporaryParent);
      expect(path.basename(root).startsWith("kernel-build-parent-test-")).toBe(
        true,
      );
      await rm(root, { recursive: true, force: true });
    }
  });

  it("publishes only a complete closed identity from its temporary sibling", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const events = [];
    let temporary;
    try {
      const metadata = await stampAdminBuild({
        environment: publicBuildEnvironment,
        buildDirectory: fixture.build,
        openFile: async (file, flags) => {
          temporary = file;
          expect(path.relative(fixture.build, file).split(path.sep)[0]).toBe(
            "..",
          );
          expect(path.dirname(path.dirname(path.dirname(file)))).toBe(
            path.dirname(fixture.build),
          );
          expect(file).not.toBe(output);
          expect(flags).toBe("wx");
          const handle = await open(file, flags);
          return {
            writeFile: async (contents) => {
              await handle.writeFile(contents);
              await expect(readFile(output)).rejects.toMatchObject({
                code: "ENOENT",
              });
              events.push("write");
            },
            close: async () => {
              await handle.close();
              events.push("close");
            },
          };
        },
        publishDirectory: async (source, target) => {
          expect(source).toBe(path.dirname(temporary));
          expect(target).toBe(path.dirname(output));
          expect(events).toEqual(["write", "close"]);
          expect(
            JSON.parse(await readFile(path.join(source, "build.json"), "utf8")),
          ).toEqual(createBuildMetadata(publicBuildEnvironment));
          await rename(source, target);
          events.push("publish");
        },
      });
      expect(events).toEqual(["write", "close", "publish"]);
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(metadata);
      expect(await readdir(path.dirname(output))).toEqual(["build.json"]);
    } finally {
      await fixture.cleanup();
    }
  });

  it.each(["", path.sep])(
    "rejects a linked build directory with trailing separator %j",
    async (separator) => {
      const fixture = await buildFixture();
      const alias = path.join(fixture.root, "build-link");
      try {
        await symlink(
          fixture.build,
          alias,
          process.platform === "win32" ? "junction" : "dir",
        );
        await expect(
          stampAdminBuild({
            environment: publicBuildEnvironment,
            buildDirectory: alias + separator,
          }),
        ).rejects.toThrow(/ordinary directory/);
        await expect(
          readFile(path.join(fixture.build, "_kernel/build.json")),
        ).rejects.toMatchObject({ code: "ENOENT" });
      } finally {
        await fixture.cleanup();
      }
    },
  );

  it("stamps the completed build with exactly the configured immutable identity", async () => {
    const fixture = await buildFixture();
    try {
      const metadata = await stampAdminBuild({
        environment: publicBuildEnvironment,
        buildDirectory: fixture.build,
      });
      expect(metadata).toEqual({
        schemaVersion: 1,
        releaseId: "synthetic-v1",
        basePath: "/console/",
        apiOrigin: "https://api.example.com",
      });
      expect(
        JSON.parse(
          await readFile(
            path.join(fixture.build, "_kernel/build.json"),
            "utf8",
          ),
        ),
      ).toEqual(metadata);
      const stampedFile = path.join(fixture.build, "_kernel/build.json");
      const originalBytes = await readFile(stampedFile);
      await expect(
        stampAdminBuild({
          environment: {
            ...publicBuildEnvironment,
            VITE_RELEASE_ID: "another",
          },
          buildDirectory: fixture.build,
        }),
      ).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(stampedFile)).toEqual(originalBytes);
      expect(await readdir(path.dirname(stampedFile))).toEqual(["build.json"]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("keeps an interrupted partial write unpublished and permits a fresh retry", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const code = `
      import { open } from "node:fs/promises";
      import { stampAdminBuild } from ${JSON.stringify(new URL("./stamp-admin-build.mjs", import.meta.url).href)};
      process.once("disconnect", () => process.exit(1));
      await stampAdminBuild({
        environment: ${JSON.stringify(publicBuildEnvironment)},
        buildDirectory: ${JSON.stringify(fixture.build)},
        openFile: async (file, flags) => {
          const handle = await open(file, flags);
          return {
            writeFile: async (contents) => {
              const partial = contents.slice(0, 12);
              await handle.writeFile(partial);
              process.send({ temporary: file, partial });
              await new Promise(() => {});
            },
            close: () => handle.close(),
          };
        },
      });
      process.disconnect();
    `;
    const child = spawn(
      process.execPath,
      ["--input-type=module", "--eval", code],
      {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        windowsHide: true,
      },
    );
    let childFailure;
    child.on("error", (error) => {
      childFailure = error;
    });
    const closed = new Promise((resolve) => child.once("close", resolve));
    try {
      const { temporary, partial } = await new Promise((resolve, reject) => {
        const cleanup = () => {
          child.off("message", onMessage);
          child.off("error", onError);
          child.off("close", onClose);
        };
        const onMessage = (message) => {
          cleanup();
          resolve(message);
        };
        const onError = (error) => {
          cleanup();
          reject(error);
        };
        const onClose = (code, signal) => {
          cleanup();
          reject(
            new Error(
              `Build stamp child closed before readiness (code ${code}, signal ${signal}).`,
            ),
          );
        };
        child.once("message", onMessage);
        child.once("error", onError);
        child.once("close", onClose);
      });
      expect(child.kill()).toBe(true);
      await closed;
      if (childFailure) throw childFailure;

      await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(temporary, "utf8")).toBe(partial);
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
        }),
      ).resolves.toEqual(createBuildMetadata(publicBuildEnvironment));
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(
        createBuildMetadata(publicBuildEnvironment),
      );
      expect(await readFile(temporary, "utf8")).toBe(partial);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
      }
      await closed;
      await fixture.cleanup();
    }
  });

  it("preserves an identity that wins the publication race and cleans its temporary file", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const winner = Buffer.from("concurrent immutable identity\r\n");
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          publishDirectory: async (source, target) => {
            await mkdir(target);
            await writeFile(path.join(target, "build.json"), winner, {
              flag: "wx",
            });
            await rename(source, target);
          },
        }),
      ).rejects.toHaveProperty("code");
      expect(await readFile(output)).toEqual(winner);
      expect(await readdir(path.dirname(output))).toEqual(["build.json"]);
      expect(await readdir(fixture.root)).toEqual(["dist"]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("keeps the complete published identity when temporary cleanup fails", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const cleanupFailure = new Error("synthetic temporary cleanup failure");
    let temporary;
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          removeDirectory: async (directory) => {
            temporary = directory;
            throw cleanupFailure;
          },
        }),
      ).rejects.toBe(cleanupFailure);
      expect(temporary).not.toBe(output);
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(
        createBuildMetadata(publicBuildEnvironment),
      );
      expect(await readdir(temporary)).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  it.each(["write", "close"])(
    "removes only its newly acquired metadata after a %s failure",
    async (stage) => {
      const fixture = await buildFixture();
      const failure = new Error(`synthetic ${stage} failure`);
      const events = [];
      const output = path.join(fixture.build, "_kernel/build.json");
      let temporary;
      try {
        await expect(
          stampAdminBuild({
            environment: publicBuildEnvironment,
            buildDirectory: fixture.build,
            openFile: async (file, flags) => {
              events.push("open");
              temporary = file;
              expect(file).not.toBe(output);
              expect(
                path.relative(fixture.build, file).split(path.sep)[0],
              ).toBe("..");
              expect(path.dirname(path.dirname(path.dirname(file)))).toBe(
                path.dirname(fixture.build),
              );
              expect(flags).toBe("wx");
              const handle = await open(file, flags);
              return {
                writeFile: async (contents) => {
                  events.push("write");
                  await handle.writeFile(
                    stage === "write" ? "partial" : contents,
                  );
                  if (stage === "write") throw failure;
                },
                close: async () => {
                  events.push("close");
                  await handle.close();
                  if (stage === "close") throw failure;
                },
              };
            },
            removeFile: async (file) => {
              events.push("unlink");
              expect(file).toBe(temporary);
              await unlink(file);
            },
          }),
        ).rejects.toBe(failure);
        expect(events).toEqual(["open", "write", "close", "unlink"]);
        await expect(readFile(output)).rejects.toMatchObject({
          code: "ENOENT",
        });
        await expect(readFile(temporary)).rejects.toMatchObject({
          code: "ENOENT",
        });
        await expect(
          stampAdminBuild({
            environment: publicBuildEnvironment,
            buildDirectory: fixture.build,
          }),
        ).resolves.toEqual(createBuildMetadata(publicBuildEnvironment));
      } finally {
        await fixture.cleanup();
      }
    },
  );

  it("does not remove an existing file when acquiring the handle fails", async () => {
    const fixture = await buildFixture();
    const failure = new Error("synthetic acquisition failure");
    const output = path.join(fixture.build, "_kernel/build.json");
    const originalBytes = Buffer.from("existing immutable metadata\r\n");
    const removeFile = vi.fn(unlink);
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          openFile: async () => {
            await mkdir(path.dirname(output));
            await writeFile(output, originalBytes);
            throw failure;
          },
          removeFile,
        }),
      ).rejects.toBe(failure);
      expect(removeFile).not.toHaveBeenCalled();
      expect(await readFile(output)).toEqual(originalBytes);
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not remove a temporary path whose exclusive acquisition lost a race", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const unowned = Buffer.from("another writer owns this temporary file\r\n");
    const removeFile = vi.fn(unlink);
    let temporary;
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          openFile: async (file, flags) => {
            temporary = file;
            await writeFile(file, unowned, { flag: "wx" });
            return open(file, flags);
          },
          removeFile,
        }),
      ).rejects.toMatchObject({ cause: { code: "EEXIST" } });
      expect(removeFile).not.toHaveBeenCalled();
      expect(await readFile(temporary)).toEqual(unowned);
      await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await fixture.cleanup();
    }
  });

  it("retains partial-write, handle-close and owned-file cleanup errors", async () => {
    const fixture = await buildFixture();
    const primary = new Error("synthetic partial write");
    const closeFailure = new Error("synthetic handle close");
    const cleanupFailure = new Error("synthetic owned-file cleanup");
    const events = [];
    const output = path.join(fixture.build, "_kernel/build.json");
    let temporary;
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          openFile: async (file, flags) => {
            temporary = file;
            const handle = await open(file, flags);
            return {
              writeFile: async () => {
                events.push("write");
                await handle.writeFile("partial");
                throw primary;
              },
              close: async () => {
                events.push("close");
                await handle.close();
                throw closeFailure;
              },
            };
          },
          removeFile: async () => {
            events.push("unlink");
            throw cleanupFailure;
          },
        }),
      ).rejects.toMatchObject({
        errors: expect.arrayContaining([primary, closeFailure, cleanupFailure]),
        cause: primary,
      });
      expect(events).toEqual(["write", "close", "unlink"]);
      expect(await readFile(temporary, "utf8")).toBe("partial");
      await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await fixture.cleanup();
    }
  });

  it.each([
    { VITE_API_BASE_URL: "http://api.example.com" },
    { VITE_API_BASE_URL: "https://api.example.com/path" },
    { VITE_RELEASE_ID: "" },
    { VITE_RELEASE_ID: "../escape" },
    { VITE_APP_BASE_URL: "/console" },
  ])("rejects unsafe public metadata before writing anything", (patch) => {
    expect(() =>
      createBuildMetadata({ ...publicBuildEnvironment, ...patch }),
    ).toThrow();
  });

  it("refuses an incomplete build and a linked metadata output before writing outside", async () => {
    const fixture = await buildFixture();
    try {
      await writeFile(path.join(fixture.build, "index.html"), "not HTML");
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
        }),
      ).rejects.toThrow(/completed HTML/);
      await writeFile(
        path.join(fixture.build, "index.html"),
        "<html>synthetic build</html>",
      );
      const outside = path.join(fixture.root, "outside");
      await mkdir(outside);
      await symlink(
        outside,
        path.join(fixture.build, "_kernel"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
        }),
      ).rejects.toThrow(/inside the build/);
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not follow a swapped metadata directory after checking the build", async () => {
    const fixture = await buildFixture();
    const outside = path.join(fixture.root, "outside");
    const directory = path.join(fixture.build, "_kernel");
    const displaced = path.join(fixture.root, "displaced");
    await mkdir(outside);
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          openFile: async (file, flags) => {
            try {
              await rename(directory, displaced);
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
            await symlink(
              outside,
              directory,
              process.platform === "win32" ? "junction" : "dir",
            );
            return open(file, flags);
          },
        }),
      ).rejects.toHaveProperty("code");
      expect(await readdir(outside)).toEqual([]);
      await expect(
        readFile(path.join(outside, "build.json")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await fixture.cleanup();
    }
  });
});
