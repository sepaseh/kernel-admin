import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const forceOption = (value) =>
  value === "--force" ||
  value.startsWith("--force=") ||
  value === "--force-with-lease" ||
  value.startsWith("--force-with-lease=") ||
  /^-[fF]$/.test(value);
const protectedRef = (value) => /(?:^|:|\/)(?:main|master)$/.test(value);
const sensitivePath = (value) =>
  /(?:^|[/\\])\.env(?:\.|$)/i.test(value) ||
  /\.(?:pem|p12|key)$/i.test(value) ||
  /credentials\.|secret\.|keystore/i.test(value);
const inspectPush = (args) => {
  if (args.some(forceOption))
    return "Dangerous git command blocked. Ask the user first.";
  if (
    args.some((value) => value === "origin" || value === "upstream") &&
    args.some(protectedRef)
  )
    return "Direct push to main/master blocked. Ask the user first.";
  return null;
};
const inspectGitAction = (action, args) => {
  if (action === "push") return inspectPush(args);
  if (action === "reset" && args.includes("--hard"))
    return "Dangerous git command blocked. Ask the user first.";
  if (
    action === "clean" &&
    args.some((value) => value === "--force" || /^-[a-z]*f/i.test(value))
  )
    return "Dangerous git command blocked. Ask the user first.";
  if (
    action === "branch" &&
    args.some(
      (value) =>
        value === "-D" || value === "--delete" || value.startsWith("--delete="),
    )
  )
    return "Dangerous git command blocked. Ask the user first.";
  return null;
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
const shellSeparators = new Set([";", "&", "|"]);
const literalGitValue = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  !shellSeparators.has(value) &&
  !['"', "'", "`", "$"].some((marker) => value.includes(marker)) &&
  !value.endsWith("\\");
const attachedGitValue = (option) => {
  for (const prefix of ["-C", "-c"])
    if (option.startsWith(prefix) && option.length > prefix.length)
      return literalGitValue(option.slice(prefix.length));
  const separator = option.indexOf("=");
  return (
    separator !== -1 &&
    gitValueOptions.has(option.slice(0, separator)) &&
    literalGitValue(option.slice(separator + 1))
  );
};
const gitOptionWidth = (tokens, index) => {
  const option = tokens[index];
  if (gitFlags.has(option)) return 1;
  if (gitValueOptions.has(option))
    return literalGitValue(tokens[index + 1]) ? 2 : 0;
  return attachedGitValue(option) ? 1 : 0;
};
const gitActionIndex = (tokens, start) => {
  let index = start;
  while (index < tokens.length) {
    const token = tokens[index];
    if (!token.startsWith("-") || terminalGitFlags.has(token))
      return shellSeparators.has(token) ? -1 : index;
    const width = gitOptionWidth(tokens, index);
    if (width === 0) return -1;
    index += width;
  }
  return -1;
};
const inspectGitCommand = (tokens) => {
  for (let index = 0; index < tokens.length - 1; index++) {
    if (tokens[index].toLowerCase() !== "git") continue;
    const actionIndex = gitActionIndex(tokens, index + 1);
    if (actionIndex === -1)
      return "Unsupported or ambiguous git options blocked. Ask the user first.";
    const message = inspectGitAction(
      tokens[actionIndex],
      tokens.slice(actionIndex + 1),
    );
    if (message) return message;
  }
  return null;
};
const exposesEnvironment = (command, tokens) => {
  if (/\b(?:printenv|export -p)\b/i.test(command)) return true;
  const echo = command.toLowerCase().indexOf("echo");
  if (
    echo !== -1 &&
    /TOKEN|API_KEY|SECRET|PASSWORD|CREDENTIAL/i.test(command.slice(echo + 4))
  )
    return true;
  return tokens.some(
    (value, index) =>
      value === "env" && [undefined, "|", "&", ";"].includes(tokens[index + 1]),
  );
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
  const tokens = command.split(/([;&|])|\s+/).filter(Boolean);
  const gitMessage = inspectGitCommand(tokens);
  if (gitMessage) return gitMessage;
  if (sensitivePath(filePath))
    return "Editing secret or credential files is blocked. Ask the user first.";
  if (exposesEnvironment(command, tokens))
    return "Environment variable exposure blocked.";
  if (
    /production|api\.etherscan\.io|mainnet/i.test(
      `${command} ${filePath} ${content}`,
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
