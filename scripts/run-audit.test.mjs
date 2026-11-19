import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, onTestFinished } from "vitest";

import {
  hasAuditMetadata,
  hasOnlyTemporaryPicomatchFindings,
  isCompletedAuditResult,
  runAudit,
} from "./run-audit.mjs";

describe("audit result classification", () => {
  it("recognizes a completed vulnerability report", () => {
    expect(
      hasAuditMetadata(
        JSON.stringify({ metadata: { vulnerabilities: { high: 1 } } }),
      ),
    ).toBe(true);
  });

  it.each(["", "not json", JSON.stringify({ error: "Unavailable" })])(
    "treats an infrastructure response as incomplete",
    (output) => {
      expect(hasAuditMetadata(output)).toBe(false);
    },
  );

  it("rejects a zero exit status without audit metadata", () => {
    expect(isCompletedAuditResult({ status: 0, stdout: "" })).toBe(false);
  });

  it("accepts completed reports for both clean and blocking audits", () => {
    const stdout = JSON.stringify({
      metadata: { vulnerabilities: { high: 1 } },
    });

    expect(isCompletedAuditResult({ status: 0, stdout })).toBe(true);
    expect(isCompletedAuditResult({ status: 1, stdout })).toBe(true);
  });

  it("rejects terminated audit processes", () => {
    const stdout = JSON.stringify({ metadata: { vulnerabilities: {} } });

    expect(isCompletedAuditResult({ status: null, stdout })).toBe(false);
  });

  it("rejects process errors and signals even when audit metadata exists", () => {
    const stdout = JSON.stringify({ metadata: { vulnerabilities: {} } });

    expect(
      isCompletedAuditResult({
        error: new Error("Synthetic process failure"),
        status: 0,
        stdout,
      }),
    ).toBe(false);
    expect(
      isCompletedAuditResult({ signal: "SIGTERM", status: 0, stdout }),
    ).toBe(false);
    expect(isCompletedAuditResult({ stdout })).toBe(false);
  });
});

const beforeExceptionExpiry = Date.parse("2026-11-30T23:59:59.999Z");
const exceptionReport = () => {
  const report = {
    auditReportVersion: 2,
    vulnerabilities: {
      picomatch: {
        name: "picomatch",
        severity: "high",
        via: [
          {
            name: "picomatch",
            dependency: "picomatch",
            severity: "high",
            url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
            range: "<=4.0.7",
          },
        ],
        nodes: ["node_modules/picomatch"],
      },
      vite: {
        name: "vite",
        severity: "high",
        via: ["picomatch", "vitest"],
        nodes: ["node_modules/vite"],
      },
      vitest: {
        name: "vitest",
        severity: "high",
        via: ["vite"],
        nodes: ["node_modules/vitest"],
      },
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 3,
        critical: 0,
        total: 3,
      },
    },
  };
  const lockfile = {
    lockfileVersion: 3,
    packages: {
      "": { devDependencies: { vite: "8.3.5", vitest: "5.1.0" } },
      "node_modules/picomatch": { version: "4.0.7", dev: true },
      "node_modules/vite": { version: "8.3.5", dev: true },
      "node_modules/vitest": { version: "5.1.0", dev: true },
    },
  };
  return { report, lockfile };
};

describe("temporary development-only picomatch exception", () => {
  it("accepts a cyclic development-tool graph when every finding reaches the reviewed advisory", () => {
    const { report, lockfile } = exceptionReport();

    expect(
      hasOnlyTemporaryPicomatchFindings(
        report,
        lockfile,
        beforeExceptionExpiry,
      ),
    ).toBe(true);
  });

  it("accepts multiple reported copies only when each is the reviewed development version", () => {
    const { report, lockfile } = exceptionReport();
    const nested = "node_modules/nested/node_modules/picomatch";
    report.vulnerabilities.picomatch.nodes.push(nested);
    lockfile.packages[nested] = { version: "4.0.7", dev: true };

    expect(
      hasOnlyTemporaryPicomatchFindings(
        report,
        lockfile,
        beforeExceptionExpiry,
      ),
    ).toBe(true);

    lockfile.packages[nested].version = "3.0.2";

    expect(
      hasOnlyTemporaryPicomatchFindings(
        report,
        lockfile,
        beforeExceptionExpiry,
      ),
    ).toBe(false);
  });

  it("keeps an unrelated critical finding blocking alongside the approved graph", () => {
    const { report, lockfile } = exceptionReport();
    report.vulnerabilities.unrelated = {
      name: "unrelated",
      severity: "critical",
      via: [
        {
          name: "unrelated",
          dependency: "unrelated",
          severity: "critical",
          url: "https://github.com/advisories/GHSA-synthetic-other",
        },
      ],
      nodes: ["node_modules/unrelated"],
    };
    report.metadata.vulnerabilities.critical = 1;
    report.metadata.vulnerabilities.total = 4;
    lockfile.packages["node_modules/unrelated"] = {
      version: "1.0.0",
      dev: true,
    };

    expect(
      hasOnlyTemporaryPicomatchFindings(
        report,
        lockfile,
        beforeExceptionExpiry,
      ),
    ).toBe(false);
  });

  it.each([
    Date.parse("2026-12-01T00:00:00.000Z"),
    Date.parse("2026-12-01T00:00:00.001Z"),
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("blocks the exception at expiry or with an invalid clock (%s)", (now) => {
    const { report, lockfile } = exceptionReport();

    expect(hasOnlyTemporaryPicomatchFindings(report, lockfile, now)).toBe(
      false,
    );
  });

  it("retains the existing high threshold for unrelated lower-severity findings", () => {
    const { report, lockfile } = exceptionReport();
    report.vulnerabilities.unrelated = {
      name: "unrelated",
      severity: "moderate",
      via: [
        {
          name: "unrelated",
          dependency: "unrelated",
          severity: "moderate",
          url: "https://github.com/advisories/GHSA-synthetic-unrelated",
        },
      ],
      nodes: ["node_modules/unrelated"],
    };
    report.metadata.vulnerabilities.moderate = 1;
    report.metadata.vulnerabilities.total = 4;
    lockfile.packages["node_modules/unrelated"] = { version: "1.0.0" };

    expect(
      hasOnlyTemporaryPicomatchFindings(
        report,
        lockfile,
        beforeExceptionExpiry,
      ),
    ).toBe(true);
  });

  it.each([
    [
      "another picomatch version",
      ({ lockfile }) => {
        lockfile.packages["node_modules/picomatch"].version = "4.0.8";
      },
    ],
    [
      "a runtime picomatch copy",
      ({ lockfile }) => {
        delete lockfile.packages["node_modules/picomatch"].dev;
      },
    ],
    [
      "a runtime dependent",
      ({ lockfile }) => {
        lockfile.packages["node_modules/vite"].dev = false;
      },
    ],
    [
      "an affected node missing from the lock",
      ({ lockfile }) => {
        delete lockfile.packages["node_modules/vitest"];
      },
    ],
    [
      "a picomatch copy omitted from the report",
      ({ lockfile }) => {
        lockfile.packages["node_modules/nested/node_modules/picomatch"] = {
          version: "4.0.7",
          dev: true,
        };
      },
    ],
    [
      "an affected node omitted from the root finding",
      ({ report }) => {
        report.vulnerabilities.picomatch.nodes = [];
      },
    ],
    [
      "a different advisory identifier",
      ({ report }) => {
        report.vulnerabilities.picomatch.via[0].url =
          "https://github.com/advisories/GHSA-synthetic-other";
      },
    ],
    [
      "a different advisory package",
      ({ report }) => {
        report.vulnerabilities.picomatch.via[0].dependency = "other";
      },
    ],
    [
      "a new advisory on an otherwise accepted dependent",
      ({ report }) => {
        report.vulnerabilities.vitest.via.push({
          name: "vitest",
          dependency: "vitest",
          severity: "high",
          url: "https://github.com/advisories/GHSA-synthetic-other",
        });
      },
    ],
    [
      "a finding with no cause",
      ({ report }) => {
        report.vulnerabilities.vitest.via = [];
      },
    ],
    [
      "a missing cause in the report graph",
      ({ report }) => {
        report.vulnerabilities.vite.via = ["missing"];
      },
    ],
    [
      "a cycle detached from the reviewed root",
      ({ report }) => {
        report.vulnerabilities.vite.via = ["vitest"];
      },
    ],
    [
      "more blocking findings than the report contains",
      ({ report }) => {
        report.metadata.vulnerabilities.high = 4;
        report.metadata.vulnerabilities.total = 4;
      },
    ],
    [
      "invalid severity counts",
      ({ report }) => {
        report.metadata.vulnerabilities.high = "3";
      },
    ],
    [
      "an unsupported report format",
      ({ report }) => {
        report.auditReportVersion = 3;
      },
    ],
    [
      "an audit error alongside findings",
      ({ report }) => {
        report.error = { code: "SYNTHETIC_UNAVAILABLE" };
      },
    ],
  ])("blocks %s", (_, change) => {
    const fixture = exceptionReport();
    change(fixture);

    expect(
      hasOnlyTemporaryPicomatchFindings(
        fixture.report,
        fixture.lockfile,
        beforeExceptionExpiry,
      ),
    ).toBe(false);
  });
});

describe("temporary exception command result", () => {
  it.each([
    { name: "accepts only the approved report", status: 1, expected: 0 },
    { name: "preserves an unknown audit exit status", status: 7, expected: 7 },
    {
      name: "blocks an expired exception",
      status: 1,
      expected: 1,
      expired: true,
    },
    {
      name: "blocks unreadable lock metadata",
      status: 1,
      expected: 1,
      missingLock: true,
    },
    {
      name: "blocks malformed lock metadata",
      status: 1,
      expected: 1,
      malformedLock: true,
    },
  ])("$name without changing the raw report", async (fixture) => {
    const parent = fileURLToPath(
      new URL("../coverage/validation/", import.meta.url),
    );
    await mkdir(parent, { recursive: true });
    const root = await mkdtemp(
      path.join(parent, "kernel-admin-audit-exception-"),
    );
    onTestFinished(async () => {
      expect(path.dirname(root)).toBe(path.resolve(parent));
      await rm(root, { recursive: true, force: true });
    });
    const { report, lockfile } = exceptionReport();
    const rawReport = JSON.stringify(report, null, 2) + "\n";
    const lockfilePath = path.join(root, "package-lock.json");
    if (!fixture.missingLock) {
      await writeFile(
        lockfilePath,
        fixture.malformedLock ? "not JSON" : JSON.stringify(lockfile),
      );
    }
    const npmCli = path.join(root, "npm-fixture.mjs");
    await writeFile(
      npmCli,
      `process.stdout.write(${JSON.stringify(rawReport)});\nprocess.stderr.write("Synthetic npm diagnostic.\\n");\nprocess.exitCode = ${fixture.status};\n`,
    );
    const output = [];
    const errors = [];

    const status = runAudit({
      npmCli,
      lockfile: lockfilePath,
      now: fixture.expired
        ? Date.parse("2026-12-01T00:00:00Z")
        : beforeExceptionExpiry,
      stdout: { write: (chunk) => output.push(chunk) },
      stderr: { write: (chunk) => errors.push(chunk) },
    });

    expect(status).toBe(fixture.expected);
    expect(output.join("")).toBe(rawReport);
    expect(errors.join("")).toContain("Synthetic npm diagnostic.\n");
    if (fixture.expected === 0) {
      expect(errors.join("")).toContain("GHSA-fc5q-39xc-vjpf");
      expect(errors.join("")).toContain("2026-12-01");
    } else {
      expect(errors.join("")).not.toContain("accepted");
    }
  });
});

describe("audit command completion", () => {
  for (const fixture of [
    {
      name: "preserves a clean audit exit status",
      report: { metadata: { vulnerabilities: { high: 0 } } },
      status: 0,
      expectedStatus: 0,
    },
    {
      name: "preserves a completed blocking audit exit status",
      report: { metadata: { vulnerabilities: { high: 1 } } },
      status: 1,
      expectedStatus: 1,
    },
    {
      name: "fails an incomplete report without retrying a successful process",
      report: { error: "Synthetic audit unavailable" },
      status: 0,
      expectedStatus: 1,
    },
    {
      name: "fails an unavailable audit without retrying a failed process",
      report: { error: "Synthetic audit unavailable" },
      status: 7,
      expectedStatus: 1,
    },
    {
      name: "fails a silent process without inventing a successful audit",
      status: 0,
      expectedStatus: 1,
      diagnostic: "",
    },
  ]) {
    it(fixture.name, async (context) => {
      const parent = path.resolve(tmpdir());
      const root = await mkdtemp(path.join(parent, "kernel-admin-audit-cli-"));
      context.onTestFinished(async () => {
        expect(path.dirname(root)).toBe(parent);
        await rm(root, { force: true, recursive: true });
      });
      const npmCli = path.join(root, "npm-fixture.mjs");
      const invocations = path.join(root, "invocations.jsonl");
      const stdout =
        fixture.report === undefined ? "" : JSON.stringify(fixture.report);
      const diagnostic = fixture.diagnostic ?? "Synthetic npm diagnostic.\n";
      await writeFile(
        npmCli,
        `import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(invocations)}, JSON.stringify(process.argv.slice(2)) + "\\n");
process.stdout.write(${JSON.stringify(stdout)});
process.stderr.write(${JSON.stringify(diagnostic)});
process.exitCode = ${fixture.status};
`,
      );

      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("./run-audit.mjs", import.meta.url))],
        { encoding: "utf8", env: { npm_execpath: npmCli }, windowsHide: true },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(fixture.expectedStatus);
      expect(result.stdout).toBe(stdout);
      const expectedDiagnostics =
        diagnostic +
        (hasAuditMetadata(stdout)
          ? ""
          : "Online npm audit did not return a complete report.\n");
      expect(result.stderr).toBe(expectedDiagnostics);
      expect(await readFile(invocations, "utf8")).toBe(
        JSON.stringify(["audit", "--audit-level=high", "--json"]) + "\n",
      );

      const output = [];
      const errors = [];
      const status = runAudit({
        npmCli,
        stdout: { write: (chunk) => output.push(chunk) },
        stderr: { write: (chunk) => errors.push(chunk) },
      });

      expect(status).toBe(fixture.expectedStatus);
      expect(output.join("")).toBe(stdout);
      expect(errors.join("")).toBe(expectedDiagnostics);
      expect(await readFile(invocations, "utf8")).toBe(
        (
          JSON.stringify(["audit", "--audit-level=high", "--json"]) + "\n"
        ).repeat(2),
      );
    });
  }
});
