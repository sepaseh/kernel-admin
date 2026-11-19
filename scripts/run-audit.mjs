import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const auditArguments = ["audit", "--audit-level=high", "--json"];
const picomatchAdvisory = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const picomatchExceptionExpires = "2026-12-01T00:00:00Z";

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

export const hasOnlyTemporaryPicomatchFindings = (
  report,
  lockfile,
  now = Date.now(),
) => {
  if (
    !Number.isFinite(now) ||
    now >= Date.parse(picomatchExceptionExpires) ||
    report?.auditReportVersion !== 2 ||
    report.error !== undefined ||
    !report.vulnerabilities ||
    Array.isArray(report.vulnerabilities) ||
    !lockfile?.packages
  )
    return false;

  const findings = new Map(Object.entries(report.vulnerabilities));
  const counts = report.metadata?.vulnerabilities;
  const severities = ["info", "low", "moderate", "high", "critical"];
  if (
    !counts ||
    severities.some(
      (severity) =>
        !Number.isSafeInteger(counts[severity]) ||
        counts[severity] < 0 ||
        [...findings.values()].filter((entry) => entry?.severity === severity)
          .length !== counts[severity],
    ) ||
    severities.reduce((total, severity) => total + counts[severity], 0) !==
      counts.total ||
    findings.size !== counts.total
  )
    return false;

  const picomatch = findings.get("picomatch");
  const copies = Object.entries(lockfile.packages).filter(([node]) =>
    /(?:^|\/)node_modules\/picomatch$/.test(node),
  );
  if (
    !Array.isArray(picomatch?.nodes) ||
    !copies.length ||
    new Set(picomatch.nodes).size !== picomatch.nodes.length ||
    copies.length !== picomatch.nodes.length ||
    copies.some(
      ([node, entry]) =>
        entry?.version !== "4.0.7" ||
        entry.dev !== true ||
        !picomatch.nodes.includes(node),
    )
  )
    return false;

  const pending = [...findings]
    .filter(([, entry]) => ["high", "critical"].includes(entry.severity))
    .map(([name]) => name);
  const visited = new Set();
  const dependents = new Map();
  const accepted = new Set();
  while (pending.length) {
    const name = pending.pop();
    if (visited.has(name)) continue;
    const entry = findings.get(name);
    if (
      !entry ||
      !Array.isArray(entry.nodes) ||
      !entry.nodes.length ||
      entry.nodes.some(
        (node) =>
          typeof node !== "string" || lockfile.packages[node]?.dev !== true,
      ) ||
      !Array.isArray(entry.via) ||
      !entry.via.length
    )
      return false;

    visited.add(name);
    for (const via of entry.via) {
      if (typeof via === "string") {
        if (!findings.has(via)) return false;
        if (!dependents.has(via)) dependents.set(via, []);
        dependents.get(via).push(name);
        pending.push(via);
      } else if (
        name === "picomatch" &&
        entry.severity === "high" &&
        via?.url === picomatchAdvisory &&
        via.name === "picomatch" &&
        via.dependency === "picomatch" &&
        via.severity === "high" &&
        via.range === "<=4.0.7"
      ) {
        accepted.add(name);
      } else {
        return false;
      }
    }
  }

  // npm's transitive findings can cycle; each must still reach the reviewed root.
  const resolved = [...accepted];
  while (resolved.length) {
    for (const name of dependents.get(resolved.pop()) ?? []) {
      if (accepted.has(name)) continue;
      accepted.add(name);
      resolved.push(name);
    }
  }
  return accepted.has("picomatch") && accepted.size === visited.size;
};

export const runAudit = ({
  lockfile = new URL("../package-lock.json", import.meta.url),
  now,
  npmCli = process.env.npm_execpath,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) => {
  const result = spawnSync(process.execPath, [npmCli, ...auditArguments], {
    encoding: "utf8",
  });
  if (result.stdout) stdout.write(result.stdout);
  if (result.stderr) stderr.write(result.stderr);
  if (!isCompletedAuditResult(result)) {
    stderr.write("Online npm audit did not return a complete report.\n");
    return 1;
  }
  if (result.status !== 1) return result.status;

  const report = JSON.parse(result.stdout);
  if (!report.vulnerabilities?.picomatch) return result.status;

  let locked;
  try {
    locked = JSON.parse(readFileSync(lockfile, "utf8"));
  } catch {
    stderr.write(
      "Temporary picomatch exception could not verify package-lock.json.\n",
    );
    return 1;
  }
  if (hasOnlyTemporaryPicomatchFindings(report, locked, now)) {
    stderr.write(
      `Temporarily accepted GHSA-fc5q-39xc-vjpf for development-only picomatch@4.0.7 until ${picomatchExceptionExpires}. The raw audit report above is unchanged; this is not a patched dependency.\n`,
    );
    return 0;
  }
  return 1;
};

if (process.argv[1] === import.meta.filename) process.exitCode = runAudit();
