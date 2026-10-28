import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectCi, inspectSonarWorkflow } from "./check-ci.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isStrings = (value) =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === "string" && entry.trim());
const duplicates = (values) => new Set(values).size !== values.length;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export const isSafeGuidancePath = (filename) => {
  if (typeof filename !== "string" || !filename.trim()) return false;
  const normalized = filename.replaceAll("\\", "/");
  if (
    path.isAbsolute(filename) ||
    normalized.startsWith("/") ||
    normalized.includes(":") ||
    normalized.split("/").includes("..") ||
    /(?:^|\/)(?:\.git|node_modules|\.next|coverage|dist|reports)(?:\/|$)/.test(
      normalized,
    ) ||
    /(?:^|\/)server\/data(?:\/|$)/.test(normalized) ||
    /(?:^|\/)settings\.local\.json$/.test(normalized) ||
    /\.(?:pem|key|pfx|p12|sqlite|db)$/.test(normalized)
  )
    return false;
  return (
    !/(?:^|\/)\.env(?:\.|$)/.test(normalized) ||
    path.posix.basename(normalized) === ".env.example"
  );
};

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
export const validateStandaloneManifest = (pkg) => {
  const errors = [];
  if (Object.hasOwn(pkg, "workspaces"))
    errors.push(
      "The project must use one root package, without npm workspaces",
    );
  for (const field of dependencyFields)
    for (const [name, version] of Object.entries(pkg[field] ?? {}))
      if (
        name.startsWith("@kernel/") ||
        /^(?:workspace:|file:|link:)/.test(version)
      )
        errors.push(
          "Project dependencies must be independently installable: " + name,
        );
  for (const [name, command] of Object.entries(pkg.scripts ?? {}))
    if (/(?:^|\s)--(?:workspace|workspaces|prefix)(?:=|\s|$)/.test(command))
      errors.push("Project scripts must run from the root package: " + name);
  return errors;
};
const sortedEntries = (value) =>
  Object.entries(value ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
export const validateStandaloneLockfile = (lock, pkg) => {
  const errors = [];
  const locked = lock.packages?.[""];
  if (!locked || lock.name !== pkg.name)
    errors.push("The lockfile must describe the root project");
  for (const field of dependencyFields.slice(0, 3))
    if (!same(sortedEntries(locked?.[field]), sortedEntries(pkg[field])))
      errors.push("Lockfile root dependency drift: " + field);
  for (const [location, metadata] of Object.entries(lock.packages ?? {}))
    if (/^(?:apps|packages)\//.test(location) || metadata.link === true)
      errors.push("Lockfile contains a local project link: " + location);
  return errors;
};

const checkDefinitions = (definitions) => {
  const errors = [];
  const ids = definitions.map((check) => check?.id);
  if (!isStrings(ids) || !ids.length || duplicates(ids))
    errors.push("Validation check IDs must be unique nonempty strings");
  for (const check of definitions) {
    if (
      !/^npm run [\w:-]+(?: .+)?$/.test(check?.command ?? "") ||
      !["required", "advisory", "manual"].includes(check?.kind) ||
      !isStrings(check?.ciJobs) ||
      !isStrings(check?.scopes)
    ) {
      errors.push(`Invalid check definition: ${check?.id}`);
      continue;
    }
    const jobs = check.kind === "required" ? ["check"] : [];
    if (!same(check.ciJobs, jobs))
      errors.push(`Canonical CI ownership differs for ${check.id}`);
  }
  return errors;
};
const checkProfiles = (manifest, checks) => {
  const errors = [];
  for (const [name, values] of Object.entries(manifest.profiles)) {
    if (!isStrings(values) || duplicates(values)) {
      errors.push(`Invalid profile: ${name}`);
      continue;
    }
    for (const id of values)
      if (!checks.has(id))
        errors.push(`Unknown check ${id} in profile ${name}`);
  }
  const full = manifest.profiles.full;
  const required = manifest.checks
    .filter((check) => check?.kind === "required")
    .map((check) => check.id);
  const compareIds = (left, right) => left.localeCompare(right);
  if (
    !isStrings(full) ||
    !same([...full].sort(compareIds), required.sort(compareIds))
  )
    errors.push(
      "Full profile must contain every required check and no advisory/manual checks",
    );
  return errors;
};
const checkSettings = (manifest, settings, checks) => {
  const errors = [];
  const full = manifest.profiles.full;
  const projection = isStrings(full)
    ? full.map((id) => checks.get(id)?.command)
    : [];
  if (!same(settings.recommendedChecks, projection))
    errors.push(
      "settings.recommendedChecks must project validation.profiles.full in order",
    );
  if (
    settings.recommendedChecksSource?.path !== ".agents/validation.json" ||
    settings.recommendedChecksSource?.profile !== "full"
  )
    errors.push("Settings must identify the canonical validation manifest");
  for (const [name, expected] of Object.entries({
    navigation: ".agents/navigation.json",
    validation: ".agents/validation.json",
    evaluation: ".agents/evaluation/cases.json",
  }))
    if (settings[name] !== expected)
      errors.push(`Settings ${name} must point to ${expected}`);
  return errors;
};
export const validateManifest = (manifest, settings, workflows) => {
  if (
    manifest?.schemaVersion !== 1 ||
    !Array.isArray(manifest.checks) ||
    !isRecord(manifest.profiles)
  )
    return ["Invalid validation manifest schema"];
  const definitions = checkDefinitions(manifest.checks);
  const checks = new Map(manifest.checks.map((check) => [check?.id, check]));
  const errors = [
    ...definitions,
    ...checkProfiles(manifest, checks),
    ...checkSettings(manifest, settings, checks),
  ];
  if (errors.length) return errors;
  for (const [name, inspect] of [
    ["CI", inspectCi],
    ["Sonar", inspectSonarWorkflow],
  ]) {
    try {
      inspect(workflows[name], manifest);
    } catch (error) {
      errors.push(`${name} execution policy: ${error.message}`);
    }
  }
  return errors;
};

const verifyPaths = (values, label, exists) => {
  if (!isStrings(values)) return [`Invalid paths: ${label}`];
  return values
    .filter((filename) => !exists(filename))
    .map((filename) => `Missing or unsafe path in ${label}: ${filename}`);
};
const verifyChecks = (values, label, checks) => {
  if (!isStrings(values)) return [`Invalid checks: ${label}`];
  return values
    .filter((id) => !checks.has(id))
    .map((id) => `Unknown check in ${label}: ${id}`);
};
const checkTask = (task, checks, exists) => {
  const errors = [];
  if (typeof task.when !== "string" || !task.when.trim())
    errors.push(`Missing task trigger: ${task.id}`);
  for (const field of ["owners", "contracts", "tests"])
    errors.push(...verifyPaths(task[field], `${task.id}.${field}`, exists));
  if (task.rules !== undefined)
    errors.push(...verifyPaths(task.rules, `${task.id}.rules`, exists));
  if (!task.owners?.length) errors.push(`Task has no owner: ${task.id}`);
  errors.push(...verifyChecks(task.checks, task.id, checks));
  return errors;
};
const checkCase = (item, taskIds, checks, exists) => {
  const errors = [];
  if (
    typeof item.prompt?.en !== "string" ||
    !item.prompt.en.trim() ||
    !same(Object.keys(item.prompt), ["en"])
  )
    errors.push(`Case needs an English-only prompt: ${item.id}`);
  if (
    !isStrings(item.taskIds) ||
    !item.taskIds.length ||
    item.taskIds.some((id) => !taskIds.includes(id))
  )
    errors.push(`Unknown or missing task reference: ${item.id}`);
  errors.push(
    ...verifyPaths(item.evidence, item.id, exists),
    ...verifyChecks(item.checks, item.id, checks),
  );
  if (!item.evidence?.length)
    errors.push(`Case needs source evidence: ${item.id}`);
  if (
    !isStrings(item.mustExplain) ||
    !item.mustExplain.length ||
    !isStrings(item.mustNot) ||
    !item.mustNot.length
  )
    errors.push(`Case needs observable positive/negative criteria: ${item.id}`);
  return errors;
};
export const validateNavigation = (navigation, evaluation, checks, exists) => {
  if (
    navigation?.schemaVersion !== 1 ||
    !Array.isArray(navigation.tasks) ||
    !navigation.tasks.every(isRecord)
  )
    return ["Invalid navigation schema"];
  if (
    evaluation?.schemaVersion !== 1 ||
    !Array.isArray(evaluation.cases) ||
    !evaluation.cases.every(isRecord)
  )
    return ["Invalid evaluation schema"];
  const errors = [],
    ids = navigation.tasks.map((task) => task.id),
    caseIds = evaluation.cases.map((item) => item.id);
  if (!isStrings(ids) || !ids.length || duplicates(ids))
    errors.push("Navigation task IDs must be unique and nonempty");
  if (!isStrings(caseIds) || !caseIds.length || duplicates(caseIds))
    errors.push("Evaluation case IDs must be unique and nonempty");
  for (const task of navigation.tasks)
    errors.push(...checkTask(task, checks, exists));
  for (const item of evaluation.cases)
    errors.push(...checkCase(item, ids, checks, exists));
  return errors;
};

class UnsafeGuidancePathError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsafeGuidancePathError";
  }
}

const checkedPath = async (root, filename) => {
  if (!isSafeGuidancePath(filename))
    throw new UnsafeGuidancePathError(`Unsafe guidance path: ${filename}`);
  const target = path.resolve(root, filename);
  if ((await lstat(target)).isSymbolicLink())
    throw new UnsafeGuidancePathError(`Symbolic guidance path: ${filename}`);
  const actual = await realpath(target);
  const relative = path.relative(root, actual).replaceAll(path.sep, "/");
  if (relative && !isSafeGuidancePath(relative))
    throw new UnsafeGuidancePathError(
      `Guidance path escapes safe source: ${filename}`,
    );
  return target;
};
const readSource = async (root, filename) =>
  readFile(await checkedPath(root, filename), "utf8");
const collectReferences = (settings, navigation, evaluation, manifest) => [
  ...["rules", "skills", "optionalHooks", "entryPoints", "adapters"].flatMap(
    (field) => (Array.isArray(settings[field]) ? settings[field] : []),
  ),
  ...navigation.tasks.flatMap((task) =>
    ["owners", "contracts", "tests", "rules"].flatMap((field) =>
      Array.isArray(task[field]) ? task[field] : [],
    ),
  ),
  ...evaluation.cases.flatMap((item) =>
    Array.isArray(item.evidence) ? item.evidence : [],
  ),
  ...(manifest.externalWorkflows ?? []).map((entry) => entry.path),
];
const findReferences = async (root, references) => {
  const resolved = await Promise.all(
    [...new Set(references)].map(async (filename) => {
      try {
        await checkedPath(root, filename);
        return filename;
      } catch {
        // Keep an owning-reference diagnostic without reading unsafe targets.
        return null;
      }
    }),
  );
  return new Set(resolved.filter((filename) => filename !== null));
};
const checkPackageScripts = (manifest, pkg) => {
  const errors = [];
  for (const check of manifest.checks) {
    const script = check.command.match(/^npm run ([\w:-]+)/)?.[1];
    if (
      /(?:^|\s)--(?:workspace|workspaces|prefix)(?:=|\s|$)/.test(check.command)
    )
      errors.push(
        "Manifest commands must run from the root package: " + check.command,
      );
    if (!script || !pkg.scripts?.[script])
      errors.push(`Manifest command has no package script: ${check.command}`);
  }
  return errors;
};
const walkMarkdown = async (root, directory) => {
  let entries;
  try {
    entries = await readdir(await checkedPath(root, directory), {
      withFileTypes: true,
    });
  } catch (error) {
    return {
      files: [],
      errors: error.code === "ENOENT" ? [] : [error.message],
    };
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const inspected = await Promise.all(
    entries.map((entry) => {
      const filename = path.posix.join(directory, entry.name);
      if (entry.isSymbolicLink())
        return { files: [], errors: [`Symbolic guidance path: ${filename}`] };
      if (entry.isDirectory()) return walkMarkdown(root, filename);
      return {
        files: entry.isFile() && entry.name.endsWith(".md") ? [filename] : [],
        errors: [],
      };
    }),
  );
  return {
    files: inspected.flatMap((entry) => entry.files),
    errors: inspected.flatMap((entry) => entry.errors),
  };
};
const markdownInventory = async (root) => {
  const [trees, rootEntries] = await Promise.all([
    Promise.all(
      [".agents", ".claude", "docs", "src"].map((directory) =>
        walkMarkdown(root, directory),
      ),
    ),
    readdir(root),
  ]);
  const source = trees[3].files.filter((filename) =>
    /^AGENTS(?:\.fa)?\.md$/.test(path.posix.basename(filename)),
  );
  const roots = rootEntries
    .filter((filename) => filename.endsWith(".md"))
    .sort((left, right) => left.localeCompare(right));
  const files = [
    ...new Set([
      ...trees.slice(0, 3).flatMap((entry) => entry.files),
      ...source,
      ...roots,
      "AGENTS.md",
      "docs/source-navigation.md",
      "docs/source-navigation.fa.md",
      "docs/validation.md",
      "docs/validation.fa.md",
      "docs/comprehension-evaluation.md",
      "docs/comprehension-evaluation.fa.md",
    ]),
  ];
  return { files, errors: trees.flatMap((entry) => entry.errors) };
};
const inspectMarkdownLink = async (root, filename, link) => {
  if (/^(?:https?:|mailto:|codex:|#)/i.test(link)) return [];
  try {
    const target = decodeURIComponent(
      link.split(/[?#]/)[0].replace(/^<|>$/g, ""),
    );
    const relative =
      path
        .relative(root, path.resolve(root, path.dirname(filename), target))
        .replaceAll(path.sep, "/") || ".";
    await checkedPath(root, relative);
    return [];
  } catch (error) {
    const reason =
      error instanceof UnsafeGuidancePathError
        ? "Unsafe guide link"
        : "Missing or unsafe guide link";
    return [reason + ": " + filename + ": " + link];
  }
};
const markdownIndent = (line, start = 0) => {
  let end = start,
    width = 0;
  while (line[end] === " " || line[end] === "\t") {
    width += line[end] === "\t" ? 4 - (width % 4) : 1;
    end++;
  }
  return { end, width };
};
const markdownColumn = (line, end) => {
  let column = 0;
  for (let index = 0; index < end; index++)
    column += line[index] === "\t" ? 4 - (column % 4) : 1;
  return column;
};
const markdownQuote = (line, container) => {
  let start = 0,
    depth = 0;
  const indents = [];
  while (start < line.length) {
    const indent = markdownIndent(line, start);
    const allowed = depth === container?.depth ? container.base + 3 : 3;
    if (indent.width > allowed || line[indent.end] !== ">") break;
    indents.push(indent.width);
    depth++;
    start = indent.end + 1;
    if (line[start] === " " || line[start] === "\t") start++;
  }
  return { text: line.slice(start), depth, indents };
};
const markdownFence = (line, base = 0) => {
  const indent = markdownIndent(line);
  if (indent.width - base > 3) return null;
  const marker = line[indent.end];
  if (marker !== "\x60" && marker !== "~") return null;
  let end = indent.end;
  while (line[end] === marker) end++;
  if (end - indent.end < 3) return null;
  return { marker, length: end - indent.end, suffix: line.slice(end) };
};
const markdownContainer = (quote, state) => {
  if (quote.depth !== state.quoteDepth) {
    state.lists = [];
    state.paragraph = false;
    state.indented = false;
  }
  state.quoteDepth = quote.depth;
  const indent = markdownIndent(quote.text);
  const blank = quote.text.trim() === "";
  if (!blank)
    while (state.lists.length && indent.width < state.lists.at(-1).content)
      state.lists.pop();
  const base = state.lists.at(-1)?.content ?? 0;
  const code = indent.width - base >= 4 && (!state.paragraph || state.indented);
  const list = code
    ? null
    : /^([-+*]|\d{1,9}[.)])[ \t]+/.exec(quote.text.slice(indent.end));
  if (list) {
    while (state.lists.length && state.lists.at(-1).marker >= indent.width)
      state.lists.pop();
    const content = markdownColumn(quote.text, indent.end + list[0].length);
    state.lists.push({ marker: indent.width, content });
    return {
      blank,
      relativeIndent: 0,
      base: content,
      fenceText: quote.text.slice(indent.end + list[0].length),
      fenceBase: 0,
    };
  }
  return {
    blank,
    relativeIndent: indent.width - base,
    base,
    fenceText: quote.text,
    fenceBase: base,
  };
};
const insideListQuote = (quote, fence) =>
  !fence.quoteContainer ||
  quote.indents[fence.quoteContainer.depth] >= fence.quoteContainer.base;
const insideMarkdownFence = (quote, fence) =>
  (quote.text.trim() === "" && quote.depth >= fence.depth) ||
  (quote.depth >= fence.depth &&
    markdownIndent(quote.text).width >= fence.base &&
    insideListQuote(quote, fence));
const closesMarkdownFence = (quote, fence) => {
  const marker = markdownFence(quote.text, fence.base);
  return (
    quote.depth === fence.depth &&
    marker?.marker === fence.marker &&
    marker.length >= fence.length &&
    marker.suffix.trim() === ""
  );
};
const markdownBlockContext = (quote, context) => {
  const quoted = markdownQuote(context.fenceText);
  return {
    text: quoted.text,
    fenceBase: quoted.depth ? 0 : context.fenceBase,
    depth: quote.depth + quoted.depth,
    base: quoted.depth ? 0 : context.base,
    quoteContainer: quoted.depth
      ? { depth: quote.depth, base: context.base }
      : null,
  };
};
const openingMarkdownFence = (context) => {
  const marker = markdownFence(context.text, context.fenceBase);
  if (!marker || (marker.marker === "\x60" && marker.suffix.includes("\x60")))
    return null;
  return {
    ...marker,
    depth: context.depth,
    base: context.base,
    quoteContainer: context.quoteContainer,
  };
};
const markdownProse = (markdown) => {
  const state = {
    fence: null,
    comment: null,
    inlineEnd: 0,
    lists: [],
    quoteDepth: 0,
    paragraph: false,
    indented: false,
  };
  const codeEndings = markdownCodeEndings(markdown);
  let offset = 0;
  return markdown
    .split("\n")
    .map((line) => {
      const start = offset;
      offset += line.length + 1;
      const quote = markdownQuote(
        line,
        state.fence?.quoteContainer ?? state.comment?.quoteContainer,
      );
      if (state.comment && !insideMarkdownFence(quote, state.comment))
        state.comment = null;
      if (state.comment) {
        const prose = markdownInlineProse(
          line,
          start,
          state,
          codeEndings,
          state.comment,
        );
        state.paragraph = markdownQuote(prose).text.trim() !== "";
        return prose;
      }
      if (state.fence && insideMarkdownFence(quote, state.fence)) {
        if (closesMarkdownFence(quote, state.fence)) state.fence = null;
        return "";
      }
      state.fence = null;
      const context = markdownContainer(quote, state);
      const block = markdownBlockContext(quote, context);
      const fence = openingMarkdownFence(block);
      if (fence) {
        state.fence = fence;
        state.inlineEnd = 0;
        state.paragraph = false;
        return "";
      }
      if (context.blank) {
        state.paragraph = false;
        return "";
      }
      state.indented =
        context.relativeIndent >= 4 && (!state.paragraph || state.indented);
      if (state.indented) return "";
      const prose = markdownInlineProse(line, start, state, codeEndings, block);
      state.paragraph = markdownQuote(prose).text.trim() !== "";
      return prose;
    })
    .join("\n");
};
const escapedMarkdownMarker = (text, start) => {
  let cursor = start;
  while (cursor > 0 && text[cursor - 1] === "\\") cursor--;
  return (start - cursor) % 2 === 1;
};
const markdownCodeBarriers = (text) => {
  const state = {
    lists: [],
    quoteDepth: 0,
    paragraph: false,
    indented: false,
  };
  const barriers = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const quote = markdownQuote(line);
    const context = markdownContainer(quote, state);
    state.indented =
      context.relativeIndent >= 4 && (!state.paragraph || state.indented);
    const fence = openingMarkdownFence(markdownBlockContext(quote, context));
    if (state.indented || fence) barriers.push(offset);
    state.paragraph = !context.blank && !state.indented && !fence;
    offset += line.length + 1;
  }
  return barriers;
};
const markdownCodeEndings = (text) => {
  const runs = [...text.matchAll(/`+/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    length: match[0].length,
    escaped: escapedMarkdownMarker(text, match.index),
  }));
  const byLength = new Map(),
    endings = new Map();
  const barriers = markdownCodeBarriers(text);
  let barrier = barriers.length - 1;
  for (let index = runs.length - 1; index >= 0; index--) {
    const run = runs[index];
    while (barrier >= 0 && barriers[barrier] > run.start) {
      byLength.clear();
      barrier--;
    }
    const next = byLength.get(run.length);
    if (!run.escaped && next !== undefined) endings.set(run.start, next);
    byLength.set(run.length, run.end);
  }
  return endings;
};
const closesMarkdownInline = (marker, offset, state) => {
  const closes = state.comment
    ? marker[0].endsWith("-->")
    : offset + marker.index + marker[0].length === state.inlineEnd;
  if (closes) {
    state.comment = null;
    state.inlineEnd = 0;
  }
  return closes;
};
const openingMarkdownInline = (
  line,
  marker,
  offset,
  codeEndings,
  container,
) => {
  const codeEnd = codeEndings.get(offset + marker.index);
  if (codeEnd) return { inlineEnd: codeEnd, comment: null };
  if (marker[0] === "<!--" && !escapedMarkdownMarker(line, marker.index))
    return { inlineEnd: 0, comment: container };
  return null;
};
const markdownInlineProse = (line, offset, state, codeEndings, container) => {
  const markers = /<!---?>|<!--|-->|`+/g,
    parts = [];
  let visible = 0,
    hidden = state.comment || state.inlineEnd > offset ? 0 : null;
  for (const marker of line.matchAll(markers)) {
    const end = marker.index + marker[0].length;
    if (state.comment || state.inlineEnd > offset + marker.index) {
      if (closesMarkdownInline(marker, offset, state)) {
        parts.push(" ".repeat(end - hidden));
        visible = end;
        hidden = null;
      }
      continue;
    }
    const opening = openingMarkdownInline(
      line,
      marker,
      offset,
      codeEndings,
      container,
    );
    if (!opening) continue;
    Object.assign(state, opening);
    parts.push(line.slice(visible, marker.index));
    hidden = marker.index;
  }
  parts.push(
    hidden === null ? line.slice(visible) : " ".repeat(line.length - hidden),
  );
  return parts.join("");
};
const skipMarkdownSpace = (text, start) => {
  let cursor = start;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
  return cursor;
};
const readMarkdownDelimiter = (text, start, closing, forbidden = "") => {
  let cursor = start;
  while (cursor < text.length) {
    const character = text[cursor];
    if (character === "\\") {
      cursor += 2;
      continue;
    }
    if (character === closing) return { end: cursor + 1, closed: true };
    if (forbidden.includes(character)) break;
    cursor++;
  }
  return { end: cursor, closed: false };
};
const readBareMarkdownDestination = (text, start) => {
  let cursor = start,
    depth = 0;
  while (cursor < text.length) {
    const character = text[cursor];
    if (character === "\\") {
      cursor += 2;
      continue;
    }
    if (/\s/.test(character) || (character === ")" && depth === 0)) break;
    if (character === "(") depth++;
    if (character === ")") depth--;
    cursor++;
  }
  return {
    end: cursor,
    destination: depth === 0 ? text.slice(start, cursor) : null,
  };
};
const readMarkdownDestination = (text, start) => {
  if (text[start] !== "<") return readBareMarkdownDestination(text, start);
  const result = readMarkdownDelimiter(text, start + 1, ">", "<\n\r");
  return {
    end: result.end,
    destination: result.closed ? text.slice(start + 1, result.end - 1) : null,
  };
};
// Index each delimiter once so malformed-title recovery never rescans a suffix.
const markdownDelimiterEnds = (text, closing) => {
  const ends = new Uint32Array(text.length + 1);
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] === "\\") cursor += 2;
    else {
      if (text[cursor] === closing) ends[cursor] = 1;
      cursor++;
    }
  }
  let next = 0;
  for (let index = text.length - 1; index >= 0; index--) {
    if (ends[index]) next = index + 1;
    ends[index] = next;
  }
  return ends;
};
const readMarkdownTitle = (text, start, closing, endings) => {
  if (!endings.has(closing))
    endings.set(closing, markdownDelimiterEnds(text, closing));
  const end = endings.get(closing)[start];
  return { end: end || text.length, closed: end !== 0 };
};
const finishMarkdownLink = (text, start, endings) => {
  const cursor = skipMarkdownSpace(text, start);
  if (text[cursor] === ")") return { end: cursor + 1, closed: true };
  const closing = { '"': '"', "'": "'", "(": ")" }[text[cursor]];
  if (!closing || cursor === start) return { end: cursor, closed: false };
  const title = readMarkdownTitle(text, cursor + 1, closing, endings);
  if (!title.closed) return { ...title, recover: true };
  const end = skipMarkdownSpace(text, title.end);
  return {
    end: end + 1,
    closed: text[end] === ")",
    recover: text[end] !== ")",
  };
};
const unescapeMarkdownDestination = (destination) =>
  destination.replace(/\\(.)/g, (escape, character) =>
    "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".includes(character)
      ? character
      : escape,
  );
const markdownLabelClosings = (text) => {
  const closings = new Uint8Array(text.length);
  let cursor = 0,
    depth = 0;
  while (cursor < text.length) {
    if (text[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (text[cursor] === "[") depth++;
    if (text[cursor] === "]" && depth > 0) {
      closings[cursor] = 1;
      depth--;
    }
    cursor++;
  }
  return closings;
};
export const markdownLinks = (markdown) => {
  const prose = markdownProse(markdown);
  const labels = markdownLabelClosings(prose);
  const links = [],
    endings = new Map();
  let cursor = 0;
  while (cursor < prose.length) {
    const opening = prose.indexOf("](", cursor);
    if (opening === -1) break;
    if (!labels[opening]) {
      cursor = opening + 2;
      continue;
    }
    const start = skipMarkdownSpace(prose, opening + 2);
    const result = readMarkdownDestination(prose, start);
    const ending = result.destination
      ? finishMarkdownLink(prose, result.end, endings)
      : { end: result.end, closed: false };
    if (ending.closed)
      links.push(unescapeMarkdownDestination(result.destination));
    cursor = ending.recover ? opening + 2 : Math.max(opening + 2, ending.end);
  }
  return links;
};
const inspectMarkdown = async (root, filename) => {
  const errors = [];
  const assistantGuide =
    filename.startsWith(".agents/") ||
    filename.startsWith(".claude/") ||
    /^AGENTS(?:\.fa)?\.md$/.test(path.posix.basename(filename));
  if (assistantGuide && filename.endsWith(".fa.md"))
    errors.push(`Assistant guides must be English only: ${filename}`);
  let content;
  try {
    content = await readSource(root, filename);
  } catch (error) {
    return [
      ...errors,
      `Missing or unsafe maintained guide: ${filename}: ${error.message}`,
    ];
  }
  const links = await Promise.all(
    markdownLinks(content).map((link) =>
      inspectMarkdownLink(root, filename, link),
    ),
  );
  return [...errors, ...links.flat()];
};
const inspectObsoleteRoots = async (root) => {
  const inspected = await Promise.all(
    ["apps", "packages"].map(async (name) => {
      try {
        await lstat(path.join(root, name));
        return [`Obsolete project container must be removed: ${name}`];
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        return [];
      }
    }),
  );
  return inspected.flat();
};
export const checkGuidance = async (directory = repository) => {
  const root = await realpath(directory);
  const json = async (filename) => JSON.parse(await readSource(root, filename));
  const [manifest, settings, navigation, evaluation, pkg, lock, ci, sonar] =
    await Promise.all([
      json(".agents/validation.json"),
      json(".agents/settings.json"),
      json(".agents/navigation.json"),
      json(".agents/evaluation/cases.json"),
      json("package.json"),
      json("package-lock.json"),
      readSource(root, ".github/workflows/ci.yml"),
      readSource(root, ".github/workflows/sonar.yml"),
    ]);
  const errors = [
    ...validateManifest(manifest, settings, { CI: ci, Sonar: sonar }),
    ...validateStandaloneManifest(pkg),
    ...validateStandaloneLockfile(lock, pkg),
    ...(await inspectObsoleteRoots(root)),
  ];
  for (const field of ["rules", "skills", "optionalHooks"])
    if (!isStrings(settings[field]))
      errors.push(`Settings ${field} must be a path array`);
  for (const field of ["entryPoints", "adapters"])
    if (settings[field] !== undefined && !isStrings(settings[field]))
      errors.push(`Settings ${field} must be a path array`);
  const references = collectReferences(
      settings,
      navigation,
      evaluation,
      manifest,
    ),
    found = await findReferences(root, references);
  errors.push(
    ...validateNavigation(
      navigation,
      evaluation,
      new Set(manifest.checks.map((check) => check.id)),
      (filename) => found.has(filename),
    ),
  );
  for (const filename of references)
    if (!found.has(filename))
      errors.push(`Guidance references missing/unsafe path: ${filename}`);
  errors.push(...checkPackageScripts(manifest, pkg));
  const markdown = await markdownInventory(root);
  const inspected = await Promise.all(
    markdown.files.map((filename) => inspectMarkdown(root, filename)),
  );
  errors.push(...markdown.errors, ...inspected.flat());
  return {
    errors,
    checks: manifest.checks.length,
    tasks: navigation.tasks.length,
    cases: evaluation.cases.length,
    markdownFiles: markdown.files.length,
  };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await checkGuidance();
    if (result.errors.length) {
      console.error(result.errors.join("\n"));
      process.exitCode = 1;
    } else
      console.log(
        `Guidance checked: ${result.checks} checks, ${result.tasks} tasks, ${result.cases} evaluation cases, ${result.markdownFiles} Markdown files. Model/client behavior is not evaluated by this check.`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
