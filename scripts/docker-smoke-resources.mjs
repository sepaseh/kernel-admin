import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function withSmokeResources(
  { identity, image, directory, docker, signals = process },
  runTest,
) {
  assert.match(identity, /^kernel-admin-smoke-[a-z0-9-]+$/);
  assert.equal(image, `${identity}:local`);
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith("kernel-admin-docker-"));
  const builder = `${identity}-builder`;
  const controller = new AbortController();
  const interrupt = (signal) => {
    const error = new Error(`Docker smoke interrupted by ${signal}.`);
    error.signal = signal;
    controller.abort(error);
  };
  const onInterrupt = () => interrupt("SIGINT");
  const onTerminate = () => interrupt("SIGTERM");
  signals.on("SIGINT", onInterrupt);
  signals.on("SIGTERM", onTerminate);
  const execute = (args) => docker(args, { signal: controller.signal });
  const containers = [
    "container",
    "ls",
    "--all",
    "--quiet",
    "--filter",
    `label=kernel.task=${identity}`,
  ];
  const images = ["image", "ls", "--quiet", "--filter", `reference=${image}`];
  const builderExists = async (run) => {
    try {
      await run(["buildx", "inspect", builder]);
      return true;
    } catch (error) {
      if (error.message.includes(`no builder "${builder}" found`)) return false;
      throw error;
    }
  };
  let claimed = false;
  let failed = false;
  let failure;
  const cleanupFailures = [];
  try {
    if (
      (await execute(containers)).trim() ||
      (await execute(images)).trim() ||
      (await builderExists(execute))
    )
      throw new Error("Disposable Docker names must not already exist.");
    claimed = true;
    await execute([
      "buildx",
      "create",
      "--name",
      builder,
      "--driver",
      "docker-container",
      "--driver-opt",
      "default-load=true",
    ]);
    await runTest({ docker: execute, builder, signal: controller.signal });
    controller.signal.throwIfAborted();
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    const attempt = async (action) => {
      try {
        await action();
      } catch (error) {
        cleanupFailures.push(error);
      }
    };
    if (claimed) {
      await attempt(async () => {
        const ids = (await docker(containers))
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        assert.ok(ids.every((id) => /^[a-f0-9]{12,64}$/.test(id)));
        if (ids.length) await docker(["container", "rm", "--force", ...ids]);
      });
      await attempt(async () => {
        if (await builderExists(docker))
          await docker(["buildx", "rm", "--force", builder]);
      });
      await attempt(async () => {
        if ((await docker(images)).trim()) await docker(["image", "rm", image]);
      });
    }
    await attempt(() => rm(directory, { recursive: true, force: true }));
    signals.removeListener("SIGINT", onInterrupt);
    signals.removeListener("SIGTERM", onTerminate);
  }
  if (cleanupFailures.length)
    throw new AggregateError(
      [...(failed ? [failure] : []), ...cleanupFailures],
      "Docker smoke cleanup failed; review the reported test and removal errors.",
    );
  if (failed) throw failure;
}
