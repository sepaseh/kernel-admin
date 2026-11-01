import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { stringify } from "yaml";

import { checkGuidance, validateManifest } from "./check-guidance.mjs";
import {
  fixture,
  inspect,
  phaseFixture,
  taskFixture,
} from "./check-guidance.test-support.mjs";

test("published-phase guidance requires one execution owner while preserving prerequisite ownership", async () => {
  const source = (name) =>
    readFile(new URL("../" + name, import.meta.url), "utf8");
  const manifest = JSON.parse(await source(".agents/validation.json"));
  const settings = JSON.parse(await source(".agents/settings.json"));
  const hosted = {
    CI: await source(".github/workflows/ci.yml"),
    Sonar: await source(".github/workflows/ci.yml"),
  };
  assert.deepEqual(validateManifest(manifest, settings, hosted), []);
  const owned = manifest.checks.filter(
    (check) =>
      check.kind === "required" ||
      (manifest.applicationReady &&
        ["visual", "browser-compatibility", "lighthouse"].includes(check.id)),
  );
  for (const { id } of owned)
    for (const jobs of [[], ["check", "other"], ["build", "check"]]) {
      const changed = structuredClone(manifest);
      changed.checks.find((item) => item.id === id).ciJobs = jobs;
      assert.match(
        validateManifest(changed, settings, hosted).join("\n"),
        /Canonical CI ownership differs/,
      );
    }
  const prerequisite = fixture();
  prerequisite.manifest.checks[0].ciJobs = ["check", "build"];
  assert.match(
    inspect(prerequisite).join("\n"),
    /Canonical CI ownership differs/,
  );
});

const createFixture = async (context, state = fixture()) => {
  const container = await mkdtemp(path.join(tmpdir(), "kernel-guidance-test-"));
  const root = path.join(container, "project");
  await mkdir(root);
  context.after(async () => {
    assert.equal(path.dirname(container), path.resolve(tmpdir()));
    assert.ok(path.basename(container).startsWith("kernel-guidance-test-"));
    await rm(container, { recursive: true, force: true });
  });
  const writeUnadmitted = async (filename, content) => {
    const target = path.join(root, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  const publicMarkdown = new Set();
  let admissionWrite = Promise.resolve();
  const publishAdmission = (value) => {
    const content = JSON.stringify(value);
    admissionWrite = admissionWrite.then(() =>
      writeUnadmitted(".github/bootstrap-policy.json", content),
    );
    return admissionWrite;
  };
  const write = async (filename, content) => {
    await writeUnadmitted(filename, content);
    if (/\.(?:md|markdown|mdx)$/i.test(filename)) {
      publicMarkdown.add(filename);
      await publishAdmission({ allowedFiles: [...publicMarkdown] });
    }
  };
  const json = async (filename, value) => {
    if (filename === ".github/bootstrap-policy.json") {
      publicMarkdown.clear();
      for (const file of value.allowedFiles ?? []) publicMarkdown.add(file);
      await publishAdmission(value);
      return;
    }
    await write(filename, JSON.stringify(value));
  };
  const { navigation, evaluation } = taskFixture();
  const normalized = state.manifest.verificationModel === "single-pass-v1";
  if (normalized) {
    navigation.tasks[0].checks = ["typecheck"];
    evaluation.cases[0].checks = ["typecheck"];
  }
  const scripts = normalized
    ? Object.fromEntries(
        state.manifest.checks.map(({ command }) => [
          command.split(" ")[2],
          "node synthetic-command.mjs",
        ]),
      )
    : { typecheck: "tsc", lighthouse: "node lab.mjs" };
  await Promise.all([
    json(".agents/validation.json", state.manifest),
    json(".agents/settings.json", state.settings),
    json(".agents/navigation.json", navigation),
    json(".agents/evaluation/cases.json", evaluation),
    json("package.json", {
      name: "guidance-fixture",
      scripts,
    }),
    json("package-lock.json", {
      name: "guidance-fixture",
      packages: { "": {} },
    }),
    write(".github/workflows/ci.yml", stringify(state.ci)),
    write(".github/workflows/sonar.yml", stringify(state.sonar)),
    write("AGENTS.md", "# Guide\n"),
    write("owner.ts", "// synthetic\n"),
    write("test.ts", "// synthetic\n"),
  ]);
  for (const name of [
    "source-navigation",
    "validation",
    "comprehension-evaluation",
  ])
    await write("docs/" + name + ".md", "# Guide\n");
  return {
    root,
    container,
    write,
    writeUnadmitted,
    json,
    state,
    navigation,
    evaluation,
  };
};

test("current guidance paths, instruction entrypoints and canonical matrix agree", async () => {
  const result = await checkGuidance();
  assert.ok(result.tasks > 0);
  assert.ok(result.cases > 0);
  assert.deepEqual(result.errors, []);
});

for (const [phase, count] of [
  ["repository-foundation", 10],
  ["storybook-verification", 12],
  ["application-verification", 17],
])
  test(`isolated ${phase} guidance validates only its actual published contract`, async (context) => {
    const state = phaseFixture(phase);
    assert.equal(state.manifest.profiles.full.length, count);
    const { root, json } = await createFixture(context, state);
    assert.deepEqual((await checkGuidance(root)).errors, []);
    state.manifest.applicationReady = !state.manifest.applicationReady;
    await json(".agents/validation.json", state.manifest);
    assert.match(
      (await checkGuidance(root)).errors.join("\n"),
      /Validation publication phase/,
    );
  });

test("host adapters are optional but existing links and English-only instruction files are checked", async (context) => {
  const { root, write } = await createFixture(context);
  assert.deepEqual((await checkGuidance(root)).errors, []);
  const adapter = ".claude/skills/design/SKILL.md";
  await write(adapter, "[Local guide](../../../AGENTS.md)\n");
  assert.deepEqual((await checkGuidance(root)).errors, []);
  for (const link of [
    "../../../missing.md",
    "../../../../outside.md",
    "../../../.env.local",
    "../../../bad%ZZ.md",
  ]) {
    await write(adapter, `[Invalid guide](${link})\n`);
    assert.ok(
      (await checkGuidance(root)).errors.some((error) =>
        error.includes("guide link"),
      ),
      link,
    );
  }
  await write(adapter, "[Local guide](../../../AGENTS.md)\n");
  for (const translated of [
    ".agents/rules/example.fa.md",
    ".claude/skills/design/SKILL.fa.md",
    "AGENTS.fa.md",
    "docs/guide.fa.md",
  ]) {
    await write(translated, "# Guide\n");
    assert.ok(
      (await checkGuidance(root)).errors.some((error) =>
        error.includes("English only"),
      ),
    );
    await rm(path.join(root, translated));
  }
});

test("English-only documentation covers deployment and future nested source directories", async (context) => {
  const { root, write } = await createFixture(context);
  assert.deepEqual((await checkGuidance(root)).errors, []);

  for (const translated of [
    "deploy/docker/README.fa.md",
    "deploy/native/README.fa.md",
    "collection/README.fa.md",
    ".github/guides/README.fa.md",
    "src/features/new-feature/guide.fa.md",
    "future/handbook/nested/guide.FA.MD",
    "future/handbook/guide.fa.MARKDOWN",
    "future/handbook/guide.Fa.MdX",
  ]) {
    await write(translated, "# Synthetic guide\n");
    assert.ok(
      (await checkGuidance(root)).errors.includes(
        `Maintained guides must be English only: ${translated}`,
      ),
      translated,
    );
    await rm(path.join(root, translated));
  }
});

test("renamed translated prose is rejected throughout source Markdown", async (context) => {
  const { root, write, json } = await createFixture(context);
  for (const filename of [
    "README.MD",
    "docs/guide.md",
    "deploy/native/guide.markdown",
    ".github/guides/guide.mdx",
    "src/features/new-feature/guide.md",
    "future/handbook/nested/guide.MD",
  ]) {
    await json(".github/bootstrap-policy.json", { allowedFiles: [filename] });
    await write(filename, "# راهنمای پروژه\n\nمتن راهنما\n");
    assert.ok(
      (await checkGuidance(root)).errors.includes(
        `Maintained guides must use English prose: ${filename}`,
      ),
      filename,
    );
    await rm(path.join(root, filename));
  }
});

test("translated prose in raw HTML and numeric character references is rejected", async (context) => {
  const { root, write, json } = await createFixture(context);
  await json(".github/bootstrap-policy.json", {
    allowedFiles: ["future/handbook.md"],
  });
  for (const content of [
    "<div>\nراهنمای پروژه\n</div>\n",
    "<div>\n`راهنما`\n</div>\n",
    '<p title="راهنما">English text</p>\n',
    "English <span>راهنما</span>\n",
    "# &#1585;&#1575;&#1607;&#1606;&#1605;&#1575;\n",
    "<div>\n&#x631;&#X627;&#x647;&#x646;&#x645;&#x627;\n</div>\n",
    "<p>&#0000000001585; &#x00000000000627;</p>\n",
    "<p>&#1585 &#x627</p>\n",
    "# دليل المشروع\n",
    "# Руководство\n",
  ]) {
    await write("future/handbook.md", content);
    assert.ok(
      (await checkGuidance(root)).errors.includes(
        "Maintained guides must use English prose: future/handbook.md",
      ),
      content,
    );
  }
});

test("English guides preserve literal translated UI examples and Latin names", async (context) => {
  const { root, write, json } = await createFixture(context);
  await json(".github/bootstrap-policy.json", {
    allowedFiles: ["future/handbook.md"],
  });
  await write(
    "future/handbook.md",
    [
      "# English guide",
      "The UI label is `راهنما` and the Latin name is café.",
      "The encoded UI label is `&#1585;&#1575;`.",
      "",
      "```tsx",
      'const label = "فارسی";',
      "```",
      "",
      "> ~~~tsx",
      '> const label = "العربية";',
      "> ~~~",
      "",
      '    const label = "فارسی";',
      "",
      "Malformed numeric references remain literal: &#99999999; and &#xFFFFFFFF;.",
    ].join("\n"),
  );
  assert.deepEqual((await checkGuidance(root)).errors, []);
  await write("future/handbook.md", "`راهنما` followed by راهنما\n");
  assert.ok(
    (await checkGuidance(root)).errors.includes(
      "Maintained guides must use English prose: future/handbook.md",
    ),
  );
});

test("documentation language checks exclude private and generated state", async (context) => {
  const { root, container, write, writeUnadmitted, json } =
    await createFixture(context);
  for (const directory of [
    ".git",
    "node_modules",
    "coverage",
    "dist",
    "storybook-static",
    "test-results",
    "_local-preserved",
    "releases",
    "uploads",
    "server/uploads",
    "docs/uploads",
    "future/UPLOADS",
    "server/data",
    "server/DATA",
    "operator.local",
    "docs/operator.LOCAL",
    "collection/environments",
    "deploy/docker/tls",
    ".env.local",
  ]) {
    await writeUnadmitted(
      `${directory}/private.fa.md`,
      "[private](never-read.md)\n",
    );
    await writeUnadmitted(`${directory}/private.md`, "# راهنمای خصوصی\n");
  }
  await write(
    "src/shared/i18n/locales/fa.ts",
    'export const language = "فارسی";\n',
  );
  const external = path.join(container, "outside");
  await mkdir(external);
  await writeFile(path.join(external, "private.fa.md"), "# Outside fixture\n");
  await writeFile(path.join(external, "private.md"), "# راهنمای خصوصی\n");
  await write(
    "e2e/visual/baselines/win32/metadata.json",
    JSON.stringify({ capturedAt: "2026-10-23", label: "فارسی" }),
  );
  await symlink(external, path.join(root, "external-docs"), "junction");
  await json(".github/bootstrap-policy.json", {
    allowedFiles: [
      "uploads/private.md",
      "server/data/private.md",
      "docs/operator.LOCAL/private.md",
      "collection/environments/private.md",
      "deploy/docker/tls/private.md",
      ".env.local/private.md",
      "external-docs/private.md",
      "../outside/private.md",
    ],
  });
  assert.deepEqual((await checkGuidance(root)).errors, []);

  await write("future/guide.md", "[unchecked link](missing.md)\n");
  assert.deepEqual((await checkGuidance(root)).errors, []);
});

test("unadmitted operator Markdown remains unread while filename checks stay recursive", async (context) => {
  const { root, writeUnadmitted, json } = await createFixture(context);
  await json(".github/bootstrap-policy.json", {
    allowedFiles: ["docs/source-navigation.md"],
  });
  for (const filename of [
    "operator-notes.md",
    "backups/operator-notes.md",
    "docs/backups/operator-notes.MD",
  ])
    await writeUnadmitted(
      filename,
      "# یادداشت خصوصی\n[poison](never-read.md)\n",
    );
  assert.deepEqual((await checkGuidance(root)).errors, []);
  await writeUnadmitted(
    "backups/guide.FA.MD",
    "# Synthetic private placeholder\n",
  );
  assert.deepEqual((await checkGuidance(root)).errors, [
    "Maintained guides must be English only: backups/guide.FA.MD",
  ]);
});

test("missing publication inventory fails closed before any Markdown body reads", async (context) => {
  const { root, writeUnadmitted } = await createFixture(context);
  await rm(path.join(root, ".github/bootstrap-policy.json"));
  await writeUnadmitted(
    "operator-notes.md",
    "# یادداشت خصوصی\n[poison](never-read.md)\n",
  );
  await writeUnadmitted(
    "docs/source-navigation.md",
    "# یادداشت خصوصی\n[poison](never-read.md)\n",
  );
  const { errors } = await checkGuidance(root);
  assert.equal(errors.length, 1);
  assert.match(
    errors[0],
    /Missing or unsafe publication documentation inventory/,
  );
});

test("maintained guides accept real titled and parenthesized targets", async (context) => {
  const { root, write } = await createFixture(context);
  await write("docs/file(name).md", "# Synthetic target\n");
  await write("docs/file (name).md", "# Synthetic spaced target\n");
  await write(
    "docs/source-navigation.md",
    [
      "[balanced](file(name).md)",
      "[escaped](file\\(name\\).md)",
      '[titled](file(name).md "A title")',
      "[single](file(name).md 'A title')",
      '[angle](<file (name).md> "A title")',
      "`[example](missing-inline.md)`",
      "~~~markdown",
      "[example](missing-fenced.md)",
      "~~~",
      "[real](../owner.ts)",
    ].join("\n"),
  );
  assert.deepEqual((await checkGuidance(root)).errors, []);
});

test("local query targets and case-insensitive external schemes resolve correctly", async (context) => {
  const { root, write } = await createFixture(context);
  await write("docs/guide.md", "# Synthetic target\n");
  await write(
    "docs/source-navigation.md",
    [
      "[query](guide.md?plain=1#section)",
      "[fragment](guide.md#section?literal)",
      "[https](HTTPS://example.test/guide)",
      "[mail](Mailto:guide@example.invalid)",
      "[host](Codex://example)",
    ].join("\n"),
  );
  assert.deepEqual((await checkGuidance(root)).errors, []);
});

test("only the three reviewed public environment templates are valid guide targets", async (context) => {
  const { root, write } = await createFixture(context);
  for (const filename of [
    ".env.example",
    "deploy/docker/compose.env.example",
    "deploy/native/nginx.env.example",
  ]) {
    await write(filename, "SYNTHETIC_PUBLIC_TEMPLATE=true\n");
    await write(
      "docs/source-navigation.md",
      "[template](../" + filename + ")\n",
    );
    assert.deepEqual((await checkGuidance(root)).errors, [], filename);
  }
  for (const filename of [
    "docs/.env.example",
    "docs/.env.local.md",
    "deploy/native/api.env.example",
    "deploy/native/nginx.env.example.md",
    "deploy/native/hosts.env.local",
    "deploy/native/HOSTS.ENV.EXAMPLE",
    "deploy/docker/compose.env.example.backup",
    "deploy/docker/.env/README.md",
  ]) {
    await write(filename, "[sentinel](unread-target.md)\n");
    await write(
      "docs/source-navigation.md",
      "[private](../" + filename + ")\n",
    );
    const errors = (await checkGuidance(root)).errors;
    assert.ok(
      errors.includes(
        "Unsafe guide link: docs/source-navigation.md: ../" + filename,
      ),
      filename,
    );
    assert.ok(
      !errors.some((error) => error.includes("unread-target.md")),
      filename,
    );
  }
});

test("public deployment Markdown joins maintained links without following symbolic targets", async (context) => {
  const { root, write } = await createFixture(context);
  await write(
    "deploy/docker/README.md",
    "[Guide](guide.md) [owner](../../owner.ts)\n",
  );
  await write(
    "deploy/docker/guide.md",
    "[English](README.md) [owner](../../owner.ts)\n",
  );
  assert.deepEqual((await checkGuidance(root)).errors, []);
  await write("deploy/docker/guide.md", "[broken](missing.md)\n");
  assert.ok(
    (await checkGuidance(root)).errors.includes(
      "Missing or unsafe guide link: deploy/docker/guide.md: missing.md",
    ),
  );
  await write("server/data/never-read.md", "[sentinel](unread-target.md)\n");
  await symlink(
    path.join(root, "server/data"),
    path.join(root, "deploy/alias"),
    "junction",
  );
  const errors = (await checkGuidance(root)).errors.join("\n");
  assert.match(errors, /Symbolic guidance path: deploy\/alias/);
  assert.ok(!errors.includes("unread-target.md"));
});

test("unsafe existing destinations fail for safety while missing targets retain missing diagnostics", async (context) => {
  const { root, container, write } = await createFixture(context);
  await write(".env.local", "SYNTHETIC_UNREAD_SECRET_FIXTURE\n");
  await writeFile(
    path.join(container, "outside.md"),
    "# Synthetic owned outside target\n",
  );
  for (const destination of [
    "../.env.local",
    "../.env.local?plain=1",
    "../../outside.md",
  ]) {
    for (const text of [
      '[bad](owner.ts "unfinished\n[unsafe](' + destination + ' "A title")\n',
      "`code`\n    [unsafe](" + destination + ")\n",
      "` [unsafe](" + destination + ")\n\n> closing`\n",
      "- > ~~~\n  > [example](ignored.md)\n>\n  > [unsafe](" +
        destination +
        ")\n",
      "<pre>\n[example](ignored.md)\n</pre>\n[unsafe](" + destination + ")\n",
      'prefix <a title="[example](ignored.md)"> [unsafe](' +
        destination +
        ")\n",
      'prefix <a 1x="[unsafe](' + destination + ')">\n',
      "<div>\n[example](ignored.md)\n</div>\n\n[unsafe](" + destination + ")\n",
      "prefix <![CDATA[[example](ignored.md)]]> [unsafe](" +
        destination +
        ")\n",
    ]) {
      await write("docs/source-navigation.md", text);
      assert.ok(
        (await checkGuidance(root)).errors.includes(
          "Unsafe guide link: docs/source-navigation.md: " + destination,
        ),
        text,
      );
    }
  }
  await write("docs/source-navigation.md", "[missing](missing(name).md)\n");
  assert.ok(
    (await checkGuidance(root)).errors.includes(
      "Missing or unsafe guide link: docs/source-navigation.md: missing(name).md",
    ),
  );
});

test("missing indexed paths, scripts and obsolete package containers fail validation", async (context) => {
  const { root, json, state } = await createFixture(context);
  state.settings.rules = [".agents/missing.md", ".env.local"];
  await json(".agents/settings.json", state.settings);
  await json("package.json", { name: "guidance-fixture", scripts: {} });
  await mkdir(path.join(root, "apps"));
  const errors = (await checkGuidance(root)).errors.join("\n");
  for (const message of [
    "missing/unsafe",
    "no package script",
    "Obsolete project container",
  ])
    assert.ok(errors.includes(message), message);
});

test("parallel guidance inspection reports files and link failures in deterministic order", async (context) => {
  const { root, write } = await createFixture(context);
  await Promise.all([
    write(
      ".agents/rules/ordered.md",
      "[first](missing-b.md) [second](missing-a.md)\n",
    ),
    write(".claude/skills/example/SKILL.md", "[third](missing-c.md)\n"),
    write("docs/ordered.md", "[fourth](missing-d.md) [fifth](missing-e.md)\n"),
  ]);
  const first = await checkGuidance(root);
  const second = await checkGuidance(root);
  assert.deepEqual(first.errors, second.errors);
  assert.deepEqual(first.errors, [
    "Missing or unsafe guide link: .agents/rules/ordered.md: missing-b.md",
    "Missing or unsafe guide link: .agents/rules/ordered.md: missing-a.md",
    "Missing or unsafe guide link: .claude/skills/example/SKILL.md: missing-c.md",
    "Missing or unsafe guide link: docs/ordered.md: missing-d.md",
    "Missing or unsafe guide link: docs/ordered.md: missing-e.md",
  ]);
});

test("symbolic documentation directories are rejected without reading target prose", async (context) => {
  const { root, write, json, navigation } = await createFixture(context);
  await write("server/data/never-read.md", "[sentinel](unread-target.md)\n");
  await symlink(
    path.join(root, "server/data"),
    path.join(root, "docs/alias"),
    "junction",
  );
  navigation.tasks[0].owners = ["docs/alias/never-read.md"];
  await json(".agents/navigation.json", navigation);
  const errors = (await checkGuidance(root)).errors.join("\n");
  assert.match(errors, /Symbolic guidance path/);
  assert.match(errors, /missing\/unsafe/);
  assert.ok(!errors.includes("unread-target.md"));
});

test("symbolic essential configuration is rejected before parsing outside JSON", async (context) => {
  const { root, write } = await createFixture(context);
  const outside = await mkdtemp(path.join(tmpdir(), "kernel-guidance-test-"));
  context.after(async () => {
    assert.equal(path.dirname(outside), path.resolve(tmpdir()));
    assert.ok(path.basename(outside).startsWith("kernel-guidance-test-"));
    await rm(outside, { recursive: true, force: true });
  });
  for (const name of [
    "validation.json",
    "settings.json",
    "navigation.json",
    "evaluation/cases.json",
  ]) {
    await mkdir(path.dirname(path.join(outside, name)), { recursive: true });
    await writeFile(path.join(outside, name), "UNREAD_OUTSIDE_JSON");
  }
  await rename(path.join(root, ".agents"), path.join(root, "original-agents"));
  await symlink(outside, path.join(root, ".agents"), "junction");
  await assert.rejects(checkGuidance(root), /escapes safe source/);
  assert.equal(
    await readFile(path.join(outside, "validation.json"), "utf8"),
    "UNREAD_OUTSIDE_JSON",
  );
  await write("README.md", "# Synthetic fixture\n");
});
