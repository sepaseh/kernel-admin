import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const shellError =
  "Unsupported or ambiguous shell syntax blocked. Ask the user first.";
const gitError =
  "Unsupported or ambiguous git options blocked. Ask the user first.";
const environmentError = "Environment variable exposure blocked.";
const secretError =
  "Editing secret or credential files is blocked. Ask the user first.";
const dangerousGit = "Dangerous git command blocked. Ask the user first.";
const rejectShell = () => {
  throw new Error(shellError);
};
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasVariable = (token) => /\$[A-Za-z_{0-9?*@#!-]/.test(token.expansion);
const sensitivePath = (value) =>
  /(?:^|[/\\])\.env(?:\.|$)/i.test(value) ||
  /\.(?:pem|p12|key)$/i.test(value) ||
  /credentials\.|secret\.|keystore/i.test(value);
const commandName = (value) =>
  path.posix.basename(value.replaceAll("\\", "/")).toLowerCase();
const protectedRef = (value) => /(?:^|:|\/)(?:main|master)$/.test(value);
const shortFlags = (value) => /^-[A-Za-z]+$/.test(value);
const forceOption = (value) =>
  value === "--force" ||
  value.startsWith("--force=") ||
  value === "--force-with-lease" ||
  value.startsWith("--force-with-lease=") ||
  (shortFlags(value) && /[fF]/.test(value));

const escapedPiece = (command, index, doubleQuoted = false) => {
  const next = command[index + 1];
  if (next === undefined) return rejectShell();
  if (doubleQuoted && !['"', "\\", "$", "\x60", "\n"].includes(next))
    return { value: "\\", expansion: "\\", next: index + 1 };
  return { value: next === "\n" ? "" : next, expansion: "", next: index + 2 };
};
const ordinaryPiece = (command, index) => {
  const value = command[index];
  if (
    value === "\x60" ||
    (value === "$" && ["(", "'", '"'].includes(command[index + 1]))
  )
    return rejectShell();
  return { value, expansion: value, next: index + 1 };
};
const doubleQuotedPiece = (command, start) => {
  let cursor = start + 1;
  let value = "",
    expansion = "";
  while (cursor < command.length) {
    if (command[cursor] === '"') return { value, expansion, next: cursor + 1 };
    const piece =
      command[cursor] === "\\"
        ? escapedPiece(command, cursor, true)
        : ordinaryPiece(command, cursor);
    value += piece.value;
    expansion += piece.expansion;
    cursor = piece.next;
  }
  return rejectShell();
};
const wordPiece = (command, index) => {
  const character = command[index];
  if (character === "'") {
    const closing = command.indexOf("'", index + 1);
    if (closing === -1) return rejectShell();
    return {
      value: command.slice(index + 1, closing),
      expansion: "",
      next: closing + 1,
    };
  }
  if (character === '"') return doubleQuotedPiece(command, index);
  if (character === "\\") return escapedPiece(command, index);
  if (character === "(" || character === ")") return rejectShell();
  return ordinaryPiece(command, index);
};
const shellWord = (command, start) => {
  let cursor = start;
  let value = "",
    expansion = "";
  while (cursor < command.length && !/[ \t\r\n;&|<>]/.test(command[cursor])) {
    const piece = wordPiece(command, cursor);
    value += piece.value;
    expansion += piece.expansion;
    cursor = piece.next;
  }
  return { kind: "word", value, expansion, start, end: cursor };
};
const shellToken = (command, start) => {
  const character = command[start];
  if (/[ \t\r]/.test(character)) return { kind: "space", end: start + 1 };
  if (character === "#") {
    const newline = command.indexOf("\n", start);
    return {
      kind: "separator",
      end: newline === -1 ? command.length : newline + 1,
    };
  }
  const pair = command.slice(start, start + 2);
  if (["<<", "<>"].includes(pair)) return rejectShell();
  if ([">>", ">&", "<&", "&>"].includes(pair))
    return { kind: "redirect", value: pair, start, end: start + 2 };
  if (character === ">" || character === "<")
    return { kind: "redirect", value: character, start, end: start + 1 };
  if ([";", "&", "|", "\n"].includes(character))
    return { kind: "separator", end: start + 1 };
  return shellWord(command, start);
};
const shellTokens = (command) => {
  const tokens = [];
  let cursor = 0;
  while (cursor < command.length) {
    const token = shellToken(command, cursor);
    if (token.kind !== "space") tokens.push(token);
    cursor = token.end;
  }
  return tokens;
};
const addRedirection = (segment, tokens, index) => {
  const operator = tokens[index],
    target = tokens[index + 1];
  if (target?.kind !== "word" || hasVariable(target)) return rejectShell();
  const previous = segment.words.at(-1);
  if (previous?.end === operator.start && /^\d+$/.test(previous.value))
    segment.words.pop();
  segment.redirections.push({ operator: operator.value, target });
};
const shellSegments = (command) => {
  const segments = [];
  let segment = { words: [], redirections: [] };
  const tokens = shellTokens(command);
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind === "separator") {
      segments.push(segment);
      segment = { words: [], redirections: [] };
    } else if (token.kind === "redirect") {
      addRedirection(segment, tokens, index);
      index++;
    } else {
      segment.words.push(token);
    }
  }
  segments.push(segment);
  return segments;
};

const gitValueOptions = new Set(["-C", "-c", "--git-dir", "--work-tree"]);
const gitFlags = new Set([
  "-p",
  "--paginate",
  "-P",
  "--no-pager",
  "--no-optional-locks",
  "--no-replace-objects",
  "--bare",
  "--literal-pathspecs",
  "--no-literal-pathspecs",
  "--glob-pathspecs",
  "--noglob-pathspecs",
  "--icase-pathspecs",
]);
const terminalGitFlags = new Set(["-v", "--version", "-h", "--help"]);
const literalGitValue = (token) =>
  token !== undefined && token.value.length > 0 && !hasVariable(token);
const attachedGitValue = (option) => {
  for (const prefix of ["-C", "-c"])
    if (option.startsWith(prefix) && option.length > prefix.length) return true;
  const separator = option.indexOf("=");
  return (
    separator !== -1 &&
    gitValueOptions.has(option.slice(0, separator)) &&
    separator < option.length - 1
  );
};
const gitOptionWidth = (tokens, index) => {
  const option = tokens[index].value;
  if (gitFlags.has(option)) return 1;
  if (gitValueOptions.has(option))
    return literalGitValue(tokens[index + 1]) ? 2 : 0;
  return attachedGitValue(option) ? 1 : 0;
};
const gitActionIndex = (tokens) => {
  let index = 1;
  while (index < tokens.length) {
    const token = tokens[index].value;
    if (!token.startsWith("-") || terminalGitFlags.has(token)) return index;
    const width = gitOptionWidth(tokens, index);
    if (width === 0) return -1;
    index += width;
  }
  return -1;
};
const pushFlags = new Set([
  "--dry-run",
  "--set-upstream",
  "--porcelain",
  "--verbose",
  "--quiet",
  "--atomic",
]);
const pushOperands = (args) => {
  const operands = [];
  for (const value of args) {
    if (!value.startsWith("-")) operands.push(value);
    else if (!pushFlags.has(value) && !/^-[nuvq]+$/.test(value)) return null;
  }
  return operands;
};
const inspectPush = (args) => {
  if (args.some((value) => forceOption(value) || value.startsWith("+")))
    return dangerousGit;
  const operands = pushOperands(args);
  if (!operands || operands.length < 2)
    return "Implicit or unsupported push destination blocked. Use an explicit remote and refspec.";
  if (operands.slice(1).some(protectedRef))
    return "Direct push to main/master blocked. Ask the user first.";
  return null;
};
const inspectGitAction = (action, args) => {
  if (action === "push") return inspectPush(args);
  if (action === "reset" && args.includes("--hard")) return dangerousGit;
  if (action === "clean" && args.some(forceOption)) return dangerousGit;
  if (
    action === "branch" &&
    args.some(
      (value) =>
        value === "-D" || value === "--delete" || value.startsWith("--delete="),
    )
  )
    return dangerousGit;
  return null;
};
const inspectGit = (words) => {
  if (words.some(hasVariable)) return gitError;
  const actionIndex = gitActionIndex(words);
  if (actionIndex === -1) return gitError;
  return inspectGitAction(
    words[actionIndex].value,
    words.slice(actionIndex + 1).map((word) => word.value),
  );
};

const assignment = (token) => /^[A-Za-z_]\w*=/.test(token.value);
const executableWords = (words) => {
  let index = 0;
  while (index < words.length && assignment(words[index])) index++;
  return words.slice(index);
};
const outputNames = new Set(["echo", "printf"]);
const secretVariable = (token) =>
  [...token.expansion.matchAll(/\$\{?([A-Za-z_]\w*)/g)].some((match) =>
    /TOKEN|API_KEY|SECRET|PASSWORD|CREDENTIAL/i.test(match[1]),
  );
const exposesEnvironment = (name, words) =>
  name === "printenv" ||
  (name === "export" && words.some((word) => word.value === "-p")) ||
  (outputNames.has(name) && words.some(secretVariable));
const secretOperands = (segment, name) => {
  if (segment.redirections.some(({ target }) => sensitivePath(target.value)))
    return true;
  return (
    !outputNames.has(name) &&
    segment.words.some((word) => sensitivePath(word.value))
  );
};
const shellNames = new Set(["bash", "sh", "bash.exe", "sh.exe"]);
const unsupportedShellNames = new Set([
  "eval",
  "source",
  ".",
  "{",
  "}",
  "if",
  "then",
  "for",
  "while",
  "case",
  "function",
]);
const shellPayload = (words) => {
  let index = 1;
  while (["--noprofile", "--norc"].includes(words[index]?.value)) index++;
  const option = words[index]?.value ?? "";
  if (!/^-[A-Za-z]+$/.test(option) || !option.includes("c")) return null;
  const payload = words[index + 1];
  return payload && !hasVariable(payload) ? payload.value : null;
};
const inspectShell = (words, depth) => {
  const payload = shellPayload(words);
  if (payload === null) return shellError;
  return inspectCommand(payload, depth + 1);
};
const inspectEnv = (segment, words, depth) => {
  const program = executableWords(words.slice(1));
  if (!program.length || program[0].value.startsWith("-"))
    return environmentError;
  return inspectSegment({ ...segment, words: program }, depth + 1);
};
const inspectWrapper = (segment, words, depth) => {
  if (!words[1] || words[1].value.startsWith("-")) return shellError;
  return inspectSegment({ ...segment, words: words.slice(1) }, depth + 1);
};
const inspectSegment = (segment, depth) => {
  if (depth > 4) return shellError;
  const words = executableWords(segment.words);
  if (!words.length) return secretOperands(segment, "") ? secretError : null;
  if (hasVariable(words[0])) return shellError;
  const name = commandName(words[0].value);
  if (secretOperands(segment, name)) return secretError;
  if (exposesEnvironment(name, words)) return environmentError;
  if (name === "git" || name === "git.exe") return inspectGit(words);
  if (shellNames.has(name)) return inspectShell(words, depth);
  if (name === "env") return inspectEnv(segment, words, depth);
  if (unsupportedShellNames.has(name)) return shellError;
  if (["command", "exec", "sudo"].includes(name))
    return inspectWrapper(segment, words, depth);
  return null;
};
const inspectCommand = (command, depth = 0) => {
  if (command.length > 65_536 || depth > 4) return shellError;
  try {
    for (const segment of shellSegments(command)) {
      const message = inspectSegment(segment, depth);
      if (message) return message;
    }
    return null;
  } catch {
    return shellError;
  }
};

export const inspectSafetyPayload = (payload) => {
  if (!isRecord(payload))
    return "Safety hook received invalid input; command blocked.";
  const input = payload.tool_input ?? payload;
  if (!isRecord(input))
    return "Safety hook received invalid input; command blocked.";
  const command = String(input.command ?? "");
  const content = String(input.content ?? "");
  const filePath = String(input.file_path ?? "");
  const commandMessage = inspectCommand(command);
  if (commandMessage) return commandMessage;
  if (sensitivePath(filePath)) return secretError;
  if (
    /production|api\.etherscan\.io|mainnet/i.test(
      command + " " + filePath + " " + content,
    )
  )
    return "Production endpoint detected. Ask the user first.";
  return null;
};
export const inspectSafetyJson = (input) => {
  try {
    return inspectSafetyPayload(JSON.parse(input));
  } catch {
    return "Safety hook received invalid JSON; command blocked.";
  }
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const message = inspectSafetyJson(fs.readFileSync(0, "utf8"));
  if (message) {
    process.stderr.write(message + "\n");
    process.exitCode = 2;
  }
}
