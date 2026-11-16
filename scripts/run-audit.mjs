import { spawnSync } from "node:child_process";
import process from "node:process";

const auditArguments = ["audit", "--audit-level=high", "--json"];

export const hasAuditMetadata = (output) => {
  try {
    const report = JSON.parse(output);
    return Boolean(report?.metadata?.vulnerabilities);
  } catch {
    return false;
  }
};

export const isCompletedAuditResult = (result) =>
  Number.isInteger(result.status) &&
  result.status >= 0 &&
  !result.error &&
  !result.signal &&
  hasAuditMetadata(result.stdout);

export const runAudit = ({
  npmCli = process.env.npm_execpath,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) => {
  const result = spawnSync(process.execPath, [npmCli, ...auditArguments], {
    encoding: "utf8",
  });
  if (result.stdout) stdout.write(result.stdout);
  if (result.stderr) stderr.write(result.stderr);
  if (isCompletedAuditResult(result)) return result.status;

  stderr.write("Online npm audit did not return a complete report.\n");
  return 1;
};

if (process.argv[1] === import.meta.filename) process.exitCode = runAudit();
