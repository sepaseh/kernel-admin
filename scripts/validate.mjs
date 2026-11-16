import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
export const commandArguments = (command) => {
  if (typeof command !== "string" || /[;&|<>\x60$\r\n]/.test(command))
    throw new Error("Validation commands must not contain shell operators");
  const args = command
    .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)
    ?.map((token) =>
      token.replace(
        /^(?:"(.*)"|'(.*)')$/,
        (_, double, single) => double ?? single,
      ),
    );
  if (
    args?.[0] !== "npm" ||
    args[1] !== "run" ||
    !/^[\w:][\w:-]*$/.test(args[2] ?? "")
  )
    throw new Error("Validation commands must use a declared npm script");
  const separator = args.indexOf("--");
  const npmOptions =
    separator === -1 ? args.slice(3) : args.slice(3, separator);
  if (npmOptions.length > 0)
    throw new Error("Validation commands must pass script arguments after --");
  return args.slice(1);
};
const indexChecks = (definitions) => {
  if (!Array.isArray(definitions) || !definitions.length)
    throw new Error("Validation checks must be a nonempty array");
  const checks = new Map();
  for (const check of definitions) {
    if (
      typeof check?.id !== "string" ||
      !check.id.trim() ||
      !["required", "advisory", "manual"].includes(check.kind) ||
      checks.has(check.id)
    )
      throw new Error("Validation checks need unique IDs and declared kinds");
    checks.set(check.id, check);
  }
  return checks;
};
export const runProfile = (manifest, profile, run) => {
  const ids = manifest?.profiles?.[profile];
  if (!Array.isArray(ids) || !ids.length)
    throw new Error("Unknown or empty validation profile: " + profile);
  const checks = indexChecks(manifest.checks);
  if (new Set(ids).size !== ids.length)
    throw new Error("Validation profiles must not repeat check IDs");
  const commands = ids.map((id) => {
    const check = checks.get(id);
    if (!check) throw new Error("Unknown validation check: " + id);
    return { args: commandArguments(check.command), check };
  });
  if (profile === "full") {
    const required = [...checks.values()].filter(
      (check) => check.kind === "required",
    );
    if (
      required.length !== commands.length ||
      commands.some(({ check }) => check.kind !== "required")
    )
      throw new Error(
        "The full profile must run every required check exactly once",
      );
  }
  if (profile === "complete" && manifest.applicationReady === true) {
    const required = [...checks.values()].filter(
      (check) => check.kind === "required",
    );
    const expected = required
      .map((check) =>
        check.id === "application-e2e" ? "browser-compatibility" : check.id,
      )
      .concat("visual");
    if (
      JSON.stringify(ids) !== JSON.stringify(expected) ||
      checks.get("browser-compatibility")?.command !==
        "npm run test:e2e:complete" ||
      checks.get("visual")?.command !== "npm run test:visual"
    )
      throw new Error(
        "Complete verification must retain every core check, replace Chromium with the full browser matrix and compare images exactly once",
      );
  }
  for (const { args, check } of commands) {
    const result = run(args, check);
    if (result !== 0) return result ?? 1;
  }
  return 0;
};

const isVerificationBuild = (check) =>
  check.id === "application-build" &&
  check.command === "npm run build:verification";

const requireTypecheckedSource = async (sourceFingerprint, expected, phase) => {
  if (
    !/^[a-f\d]{64}$/.test(expected) ||
    (await sourceFingerprint()) !== expected
  )
    throw new Error(
      `Source changed ${phase} its typecheck. Run verification again.`,
    );
};

const runCoordinatedCheck = async (
  { args, check },
  state,
  { run, sourceFingerprint, sharesTypecheck },
) => {
  const typecheck =
    sharesTypecheck &&
    check.id === "typecheck" &&
    check.command === "npm run typecheck";
  const build = isVerificationBuild(check);
  const before = typecheck ? await sourceFingerprint() : undefined;
  if (build && state.checkedSource !== undefined)
    await requireTypecheckedSource(
      sourceFingerprint,
      state.checkedSource,
      "after",
    );
  const invocation =
    build && state.checkedSource !== undefined
      ? [...args, "--", "--typechecked-source", state.checkedSource]
      : args;
  const result = await run(invocation, check, {
    reusableBuild: state.reusableBuild,
  });
  if (result !== 0) return result ?? 1;
  if (typecheck) {
    await requireTypecheckedSource(sourceFingerprint, before, "during");
    state.checkedSource = before;
  }
  if (build) state.reusableBuild = true;
  return 0;
};

export const executeProfile = async (
  manifest,
  profile,
  run,
  sourceFingerprint = async () => {
    const { verificationSourceIdentity } = await import("./run-visual.mjs");
    return (await verificationSourceIdentity(repository, process.env))
      .sourceFingerprint;
  },
) => {
  const commands = [];
  runProfile(manifest, profile, (args, check) => {
    commands.push({ args, check });
    return 0;
  });
  const sharesTypecheck =
    commands.some(
      ({ check }) =>
        check.id === "typecheck" && check.command === "npm run typecheck",
    ) && commands.some(({ check }) => isVerificationBuild(check));
  const state = { checkedSource: undefined, reusableBuild: false };
  const drivers = { run, sourceFingerprint, sharesTypecheck };
  return commands.reduce(
    (previous, command) =>
      previous.then((result) => {
        if (result !== 0) return result;
        return runCoordinatedCheck(command, state, drivers);
      }),
    Promise.resolve(0),
  );
};
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const manifest = JSON.parse(
    await readFile(path.join(repository, ".agents/validation.json"), "utf8"),
  );
  const npm =
    process.env.npm_execpath ??
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    );
  if (!existsSync(npm))
    throw new Error(
      "Run this tool through npm run validate so npm's CLI is available",
    );
  process.exitCode = await executeProfile(
    manifest,
    process.argv[2] ?? "full",
    (args, check, { reusableBuild }) => {
      console.log("Running " + check.id + ": " + check.command);
      const result = spawnSync(process.execPath, [npm, ...args], {
        cwd: repository,
        stdio: "inherit",
        windowsHide: true,
        env: {
          ...process.env,
          ...(reusableBuild ? { KERNEL_REUSE_VERIFICATION_BUILD: "1" } : {}),
        },
      });
      if (result.error) throw result.error;
      return result.status ?? 1;
    },
  );
}
