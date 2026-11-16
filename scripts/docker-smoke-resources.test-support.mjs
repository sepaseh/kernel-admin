import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { withSmokeResources } from "./docker-smoke-resources.mjs";

export async function fixture(options = {}) {
  const identity = "kernel-admin-smoke-resource-test";
  const image = `${identity}:local`;
  const directory = await mkdtemp(
    path.join(tmpdir(), "kernel-admin-docker-test-"),
  );
  const signals = new EventEmitter();
  const state = {
    builder: !!options.preexisting,
    image: !!options.preexistingImage,
    container: !!options.preexistingContainer,
  };
  const attempts = [];
  const docker = async (args, { signal, onStdout } = {}) => {
    attempts.push(args.join(" "));
    signal?.throwIfAborted();
    if (args[0] === "container" && args[1] === "ls")
      return state.container ? (options.containerId ?? "aabbccddeeff\n") : "";
    if (args[0] === "image" && args[1] === "ls")
      return state.image ? "image-id\n" : "";
    if (args[0] === "buildx" && args[1] === "inspect") {
      if (options.inspectFailure)
        throw new Error("Synthetic builder metadata error");
      if (state.builder) return `${identity}-builder\n`;
      throw new Error(`ERROR: no builder "${identity}-builder" found`);
    }
    if (args[0] === "buildx" && args[1] === "create") {
      state.builder = true;
      if (options.createFailure)
        throw new Error("Synthetic builder creation failure");
      return "";
    }
    if (args[0] === "container" && args[1] === "rm") {
      if (options.removalFailure)
        throw new Error("Synthetic container removal failure");
      state.container = false;
      return "";
    }
    if (args[0] === "image" && args[1] === "rm") {
      if (options.imageRemovalFailure)
        throw new Error("Synthetic image removal failure");
      state.image = false;
      return "";
    }
    if (args[0] === "buildx" && args[1] === "rm") {
      if (options.builderRemovalFailure)
        throw new Error("Synthetic builder removal failure");
      state.builder = false;
      if (options.lateExport) state.image = true;
      return "";
    }
    if (args[0] === "wait-for-interrupt")
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      );
    if (args[0] === "buildx" && args[1] === "build") {
      state.image = true;
      if (options.buildFailure)
        throw new Error("Synthetic image build failure");
      return "built";
    }
    if (args[0] === "run") {
      if (args.includes("--rm")) {
        if (options.certificateFailure) {
          state.container = true;
          throw new Error("Synthetic certificate creation failure");
        }
      } else {
        state.container = true;
        if (options.startFailure)
          throw new Error("Synthetic container start failure");
      }
      return "aabbccddeeff";
    }
    if (args[0] === "port") return options.port ?? "127.0.0.1:49153\r\n";
    if (args[0] === "events")
      return new Promise((resolve, reject) => {
        const stop = () => {
          signal.removeEventListener("abort", stop);
          resolve("");
        };
        signal.addEventListener("abort", stop, { once: true });
        queueMicrotask(() => {
          if (signal.aborted) return stop();
          if (options.eventFailure) {
            signal.removeEventListener("abort", stop);
            reject(new Error("Synthetic Docker event failure"));
          } else if (options.eventClose) stop();
          else if (options.starting)
            onStdout(
              JSON.stringify({
                Type: "container",
                Action: "health_status: healthy",
                Actor: { Attributes: { name: identity } },
              }) + "\n",
            );
        });
      });
    if (args[0] === "inspect") {
      return JSON.stringify({
        Running: !options.containerExit,
        ExitCode: options.containerExit ? 2 : 0,
        StartedAt: "2026-01-01T00:00:00Z",
        Health: {
          Status: options.unhealthy
            ? "unhealthy"
            : options.starting || options.eventFailure || options.eventClose
              ? "starting"
              : "healthy",
        },
      });
    }
    if (args[0] === "logs") {
      if (options.logFailure) throw new Error("Synthetic diagnostic failure");
      return "Synthetic container logs";
    }
    throw new Error(`Unexpected synthetic Docker operation: ${args.join(" ")}`);
  };
  const run = (body) =>
    withSmokeResources({ identity, image, directory, docker, signals }, body);
  const cleaned = async () => {
    await assert.rejects(stat(directory), { code: "ENOENT" });
    assert.equal(signals.listenerCount("SIGINT"), 0);
    assert.equal(signals.listenerCount("SIGTERM"), 0);
  };
  return {
    run,
    state,
    signals,
    attempts,
    cleaned,
    docker,
    directory,
    identity,
  };
}
