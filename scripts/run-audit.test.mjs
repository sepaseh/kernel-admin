import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  hasAuditMetadata,
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
