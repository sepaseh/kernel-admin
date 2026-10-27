import { spawnSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const policyPath = ".github/bootstrap-policy.json";
const coreFiles = [
  policyPath,
  ".github/workflows/pr-policy.yml",
  "scripts/check-pr-size.mjs",
  "scripts/check-pr-size.test.mjs",
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
];
const foundationFiles = [
  ".agents/validation.json",
  ".github/workflows/ci.yml",
  "package.json",
  "package-lock.json",
  "scripts/validate.mjs",
  "scripts/validate.test.mjs",
  "scripts/check-ci.mjs",
  "scripts/check-ci.test.mjs",
  "src/shared/api/token.ts",
  "src/shared/api/token.test.ts",
  "src/shared/api/types.ts",
  "src/shared/contracts/index.ts",
  "src/shared/lib/transform.ts",
  "src/shared/lib/transform.test.ts",
  "src/shared/lib/color-contrast.ts",
  "src/shared/lib/color-contrast.test.ts",
  "tsconfig.json",
];
const foundationSources = new Set([
  "src/shared/api/token.ts",
  "src/shared/api/token.test.ts",
  "src/shared/api/types.ts",
  "src/shared/contracts/index.ts",
  "src/shared/lib/transform.ts",
  "src/shared/lib/transform.test.ts",
  "src/shared/lib/color-contrast.ts",
  "src/shared/lib/color-contrast.test.ts",
]);
const isFoundationSource = (file) => foundationSources.has(file);
const catalogFiles = [
  "src/shared/i18n/catalogs.ts",
  "src/shared/i18n/catalogs.test.ts",
  "src/shared/i18n/locales.ts",
  "src/shared/i18n/dayjs/fa.ts",
  ...["ar", "de", "en", "es", "fa", "fr", "it", "pt", "ru", "tr"].map(
    (code) => `src/shared/i18n/locales/${code}.ts`,
  ),
];
const runtimeFiles = [
  "src/shared/config/language.ts",
  "src/shared/config/language.test.ts",
  "src/shared/i18n/index.ts",
  "src/shared/i18n/index.test.ts",
  "src/shared/i18n/date.ts",
  "src/shared/i18n/date.test.ts",
  "src/shared/i18n/dayjs.test.ts",
  "src/shared/lib/error.ts",
  "src/shared/lib/error.test.ts",
];
const publishedSource = (file, phase) =>
  phase !== "governance" &&
  (isFoundationSource(file) ||
    (["catalogs", "runtime-localization"].includes(phase) &&
      catalogFiles.includes(file)) ||
    (phase === "runtime-localization" && runtimeFiles.includes(file)));

export const validateBootstrapPolicy = (policy) => {
  if (
    policy?.schemaVersion !== 1 ||
    !["governance", "foundation", "catalogs", "runtime-localization"].includes(
      policy.phase,
    ) ||
    policy.applicationReady !== false ||
    policy.maximumChangedFiles !== 100 ||
    !Array.isArray(policy.allowedFiles) ||
    !policy.allowedFiles.length
  )
    throw new Error("An explicit non-runnable publication phase is required.");
  const files = new Set();
  for (const file of policy.allowedFiles) {
    if (
      typeof file !== "string" ||
      !file ||
      file.includes("\\") ||
      file.split("/").some((part) => !part || part === "." || part === "..") ||
      /[*?[\]{}:\r\n]/.test(file) ||
      /^(?:drizzle|collection|deploy|node_modules|server|coverage)(?:\/|$)/.test(
        file,
      ) ||
      file === "drizzle.config.ts" ||
      (file.startsWith("src/") && !publishedSource(file, policy.phase)) ||
      (policy.phase === "governance" &&
        /^package(?:-lock)?\.json$/.test(file)) ||
      /(?:^|\/)(?:\.env(?:\.|$)|settings\.local\.json$)/.test(file) ||
      /\.(?:pem|key|pfx|p12|sqlite|db)$/.test(file) ||
      files.has(file)
    )
      throw new Error(
        "Publication files must be unique, exact paths within their declared phase.",
      );
    files.add(file);
  }
  const requiredFiles = [
    ...coreFiles,
    ...(policy.phase === "governance"
      ? [".github/workflows/bootstrap.yml"]
      : foundationFiles),
    ...(["catalogs", "runtime-localization"].includes(policy.phase)
      ? catalogFiles
      : []),
    ...(policy.phase === "runtime-localization" ? runtimeFiles : []),
  ];
  if (requiredFiles.some((file) => !files.has(file)))
    throw new Error(
      "The bootstrap policy cannot omit its mandatory guard files.",
    );
  return files;
};

export const inspectBootstrap = async (root) => {
  if (
    (await lstat(path.join(root, ".github"))).isSymbolicLink() ||
    (await lstat(path.join(root, policyPath))).isSymbolicLink()
  )
    throw new Error("Bootstrap snapshots must not contain symbolic links.");
  const policy = JSON.parse(
    await readFile(path.join(root, policyPath), "utf8"),
  );
  const allowed = validateBootstrapPolicy(policy);
  const directories = new Set(
    [...allowed].flatMap((file) => {
      const parts = file.split("/");
      return parts
        .slice(0, -1)
        .map((_, index) => parts.slice(0, index + 1).join("/"));
    }),
  );
  const found = new Set();
  const visit = async (directory) => {
    const entries = await readdir(path.join(root, directory), {
      withFileTypes: true,
    });
    await Promise.all(
      entries.map(async (entry) => {
        const relative = directory ? `${directory}/${entry.name}` : entry.name;
        if (relative === ".git") return;
        if (
          policy.phase !== "governance" &&
          ["node_modules", "coverage"].includes(relative)
        ) {
          if (entry.isSymbolicLink() || !entry.isDirectory())
            throw new Error(
              "Generated output must be an ordinary root directory.",
            );
          return;
        }
        if (entry.isSymbolicLink())
          throw new Error(
            "Bootstrap snapshots must not contain symbolic links.",
          );
        if (entry.isDirectory() && directories.has(relative)) {
          await visit(relative);
        } else if (entry.isFile() && allowed.has(relative)) {
          found.add(relative);
        } else {
          throw new Error(`Unexpected bootstrap path: ${relative}`);
        }
      }),
    );
  };
  await visit("");
  if ([...allowed].some((file) => !found.has(file)))
    throw new Error(
      "The published bootstrap snapshot is missing declared files.",
    );

  await Promise.all(
    [...found].map(async (file) => {
      if (file.endsWith(".json"))
        JSON.parse(await readFile(path.join(root, file), "utf8"));
      if (file.endsWith(".mjs")) {
        const result = spawnSync(
          process.execPath,
          ["--check", path.join(root, file)],
          {
            cwd: root,
            encoding: "utf8",
            windowsHide: true,
          },
        );
        if (result.error || result.status !== 0)
          throw new Error(`Bootstrap JavaScript syntax is invalid: ${file}`);
      }
    }),
  );
  const scopeByPhase = {
    "runtime-localization":
      "Published admin primitives, complete catalogs and real translation/date runtime adapters; UI, API integration and browser journeys are not published or validated.",
    governance:
      "Published governance files only; the admin application is not published or validated.",
    foundation:
      "Published admin token state, transport types and pure utilities only; UI, API integration and browser behavior are not published or validated.",
    catalogs:
      "Published admin primitives and complete local catalog data; runtime translation adapters, UI, API integration and browser behavior are not published or validated.",
  };
  return {
    applicationReady: false,
    files: found.size,
    phase: policy.phase,
    scope: scopeByPhase[policy.phase],
  };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await inspectBootstrap(process.cwd());
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Bootstrap validation failed.",
    );
    process.exitCode = 1;
  }
}
