import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

import {
  parseConfiguredHostname,
  parseTarget,
  validateDastTarget,
  validateSmokeTargets,
  validateStagingTargets,
} from "./validate-workflow-targets.mjs";

const staging = {
  STAGING_ALLOWED_API_HOST: "api.staging.example.com",
  STAGING_ALLOWED_APP_HOST: "staging.example.com",
  STAGING_API_HEALTH_URL: "http://api.staging.example.com/health",
  STAGING_BASE_URL: "http://staging.example.com/app/",
};

const smoke = {
  SMOKE_ALLOWED_API_HOST: staging.STAGING_ALLOWED_API_HOST,
  SMOKE_ALLOWED_APP_HOST: staging.STAGING_ALLOWED_APP_HOST,
  SMOKE_API_HEALTH_URL: staging.STAGING_API_HEALTH_URL,
  SMOKE_BASE_URL: staging.STAGING_BASE_URL,
  SMOKE_DEPLOYMENT_ID: "synthetic-release",
  SMOKE_EXPECTED_DEPLOYMENT_ID: "synthetic-release",
};

const readRepositoryFile = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const readWorkflow = (name) =>
  parse(readRepositoryFile(`.github/workflows/${name}.yml`));

const optionalWorkflows = [
  { name: "mutation", job: "mutation", script: "test:mutation" },
  { name: "staging", job: "validate", script: "test:staging" },
  { name: "deployment-smoke", job: "smoke", script: "test:smoke" },
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("workflow target validation", () => {
  it("normalizes canonical hostnames", () => {
    expect(parseConfiguredHostname("HOST", "EXAMPLE.COM")).toBe("example.com");
  });

  it.each([
    " example.com",
    "example.com:443",
    "http://example.com",
    "-bad.example",
  ])("rejects invalid configured hostname %s", (host) =>
    expect(() => parseConfiguredHostname("HOST", host)).toThrow(),
  );

  it.each(["http://user:pass@example.com"])("rejects unsafe target %s", (url) =>
    expect(() => parseTarget("TARGET", url)).toThrow(),
  );

  it.each([
    "ftp://example.com",
    "file:///synthetic",
    "javascript:alert(1)",
    "data:text/plain,synthetic",
  ])("rejects non-HTTP workflow target %s", (url) =>
    expect(() => parseTarget("TARGET", url)).toThrow(/HTTP\(S\)/),
  );

  it("accepts staging targets on the configured hosts", () => {
    expect(() => validateStagingTargets(staging)).not.toThrow();
  });

  it("rejects a staging host mismatch", () => {
    expect(() =>
      validateStagingTargets({
        ...staging,
        STAGING_BASE_URL: "http://other.example.com",
      }),
    ).toThrow("not explicitly allowed");
  });

  it("requires matching immutable smoke deployment IDs", () => {
    const smoke = {
      SMOKE_ALLOWED_API_HOST: staging.STAGING_ALLOWED_API_HOST,
      SMOKE_ALLOWED_APP_HOST: staging.STAGING_ALLOWED_APP_HOST,
      SMOKE_API_HEALTH_URL: staging.STAGING_API_HEALTH_URL,
      SMOKE_BASE_URL: staging.STAGING_BASE_URL,
      SMOKE_DEPLOYMENT_ID: "candidate",
      SMOKE_EXPECTED_DEPLOYMENT_ID: "expected",
    };
    expect(() => validateSmokeTargets(smoke)).toThrow("expected deployment");
    expect(() =>
      validateSmokeTargets({
        ...smoke,
        SMOKE_EXPECTED_DEPLOYMENT_ID: "candidate",
      }),
    ).not.toThrow();
  });

  it("reports smoke variable names when a smoke host is not allowed", () => {
    expect(() =>
      validateSmokeTargets({
        SMOKE_ALLOWED_API_HOST: staging.STAGING_ALLOWED_API_HOST,
        SMOKE_ALLOWED_APP_HOST: staging.STAGING_ALLOWED_APP_HOST,
        SMOKE_API_HEALTH_URL: staging.STAGING_API_HEALTH_URL,
        SMOKE_BASE_URL: "http://other.example.com",
        SMOKE_DEPLOYMENT_ID: "candidate",
        SMOKE_EXPECTED_DEPLOYMENT_ID: "candidate",
      }),
    ).toThrow("SMOKE_BASE_URL host is not explicitly allowed");
  });

  it("allows authorized staging DAST and blocks production", () => {
    const env = {
      DAST_ALLOWED_HOST: "staging.example.com",
      DAST_PRODUCTION_HOST: "example.com",
      DAST_TARGET: "http://staging.example.com",
    };
    expect(() => validateDastTarget(env)).not.toThrow();
    expect(() =>
      validateDastTarget({
        ...env,
        DAST_ALLOWED_HOST: "example.com",
        DAST_TARGET: "http://example.com",
      }),
    ).toThrow("must not target the production host");
  });

  it.each([undefined, "", " staging.example.com", "staging.example.com:443"])(
    "identifies the DAST allowlist variable when its value is invalid: %s",
    (host) => {
      expect(() =>
        validateDastTarget({
          DAST_ALLOWED_HOST: host,
          DAST_PRODUCTION_HOST: "example.com",
          DAST_TARGET: "http://staging.example.com",
        }),
      ).toThrow(/^DAST_ALLOWED_HOST must /);
    },
  );

  it.each([undefined, "", " example.com", "example.com:443"])(
    "identifies the DAST production variable when its value is invalid: %s",
    (host) => {
      expect(() =>
        validateDastTarget({
          DAST_ALLOWED_HOST: "staging.example.com",
          DAST_PRODUCTION_HOST: host,
          DAST_TARGET: "http://staging.example.com",
        }),
      ).toThrow(/^DAST_PRODUCTION_HOST must /);
    },
  );
});

describe("optional verification workflows", () => {
  it("CodeQL analyzes JavaScript and Actions without running application code or elevating checkout access", () => {
    const workflow = readWorkflow("codeql");
    expect(Object.keys(workflow.on).sort()).toEqual([
      "pull_request",
      "push",
      "schedule",
      "workflow_dispatch",
    ]);
    expect(workflow.on.push.branches).toEqual(["main"]);
    expect(workflow.on.pull_request).toBeNull();
    expect(workflow.permissions).toEqual({ contents: "read" });
    const analyze = workflow.jobs.analyze;
    expect(analyze.permissions).toEqual({
      contents: "read",
      "security-events": "write",
    });
    expect(analyze.steps.map((step) => step.uses)).toEqual([
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "github/codeql-action/init@cdf488f595d80d6e07e03d4674febd5ab45fa938",
      "github/codeql-action/analyze@cdf488f595d80d6e07e03d4674febd5ab45fa938",
    ]);
    expect(analyze.steps.every((step) => step.run === undefined)).toBe(true);
    expect(analyze.steps[0].with["persist-credentials"]).toBe(false);
    expect(analyze.steps[1].with).toEqual({
      languages: "javascript-typescript,actions",
      queries: "security-extended",
    });
    for (const step of analyze.steps) {
      expect(step.if).toBeUndefined();
      expect(step["continue-on-error"]).toBeUndefined();
    }
  });

  it("DAST remains manually authorized and validates its allowlisted non-production target before scanning", () => {
    const workflow = readWorkflow("dast");
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch.inputs.target_url).toMatchObject({
      required: true,
      type: "string",
    });
    expect(workflow.permissions).toEqual({ contents: "read" });
    const suite = workflow.jobs.zap;
    expect(suite.permissions).toBeUndefined();
    expect(suite.env).toEqual({
      DAST_ALLOWED_HOST: "${{ vars.STAGING_ALLOWED_APP_HOST }}",
      DAST_PRODUCTION_HOST: "${{ vars.PRODUCTION_HOST }}",
      DAST_TARGET: "${{ inputs.target_url }}",
    });
    const [checkout, guard, scan] = suite.steps;
    expect(suite.steps).toHaveLength(3);
    expect(checkout.uses).toBe(
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
    );
    expect(checkout.with["persist-credentials"]).toBe(false);
    expect(guard.run).toBe("node scripts/validate-workflow-targets.mjs dast");
    expect(scan.uses).toBe(
      "zaproxy/action-full-scan@3c58388149901b9a03b7718852c5ba889646c27c",
    );
    expect(scan.with).toMatchObject({
      allow_issue_writing: false,
      docker_name:
        "ghcr.io/zaproxy/zaproxy:2.17.0@sha256:c558ee87358911ab17278c70991e856f57793e115d9cd0f88ca475cf82907a1a",
      fail_action: true,
      target: "${{ env.DAST_TARGET }}",
    });
    for (const step of [guard, scan]) {
      expect(step.if).toBeUndefined();
      expect(step["continue-on-error"]).toBeUndefined();
    }
  });

  it("release publication is manual, main-only and bound to this root package", () => {
    const workflow = readWorkflow("release");
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.permissions).toEqual({});
    const release = workflow.jobs.release;
    expect(release.if).toBe("github.ref == 'refs/heads/main'");
    expect(release.permissions).toEqual({ contents: "read" });
    expect(release.steps).toHaveLength(4);
    const [tokenGuard, checkout, publicationGuard, step] = release.steps;
    expect(tokenGuard.env.RELEASE_TOKEN_CONFIGURED).toBe(
      "${{ secrets.RELEASE_PLEASE_TOKEN != '' }}",
    );
    expect(tokenGuard.run).toMatch(/exit 1/);
    expect(checkout.with).toEqual({
      ref: "${{ github.sha }}",
      "persist-credentials": false,
    });
    expect(publicationGuard.run).toMatch(/\.applicationReady == true/);
    expect(publicationGuard.run).toMatch(/index\("CHANGELOG\.md"\)/);
    expect(publicationGuard.run).toMatch(/\[ ! -f CHANGELOG\.md \]/);
    expect(publicationGuard.run).toMatch(/exit 1/);
    for (const preflight of [tokenGuard, checkout, publicationGuard]) {
      expect(preflight.if).toBeUndefined();
      expect(preflight["continue-on-error"]).toBeUndefined();
    }
    expect(step.uses).toBe(
      "googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7",
    );
    expect(step.if).toBeUndefined();
    expect(step["continue-on-error"]).toBeUndefined();
    expect(step.with["config-file"]).toBe("release-please-config.json");
    expect(step.with["manifest-file"]).toBe(".release-please-manifest.json");
    expect(step.with.token).toBe("${{ secrets.RELEASE_PLEASE_TOKEN }}");
    const config = JSON.parse(readRepositoryFile(step.with["config-file"]));
    const manifest = JSON.parse(readRepositoryFile(step.with["manifest-file"]));
    const pkg = JSON.parse(readRepositoryFile("package.json"));
    expect(Object.keys(config.packages)).toEqual(["."]);
    expect(config.packages["."]).toMatchObject({
      "package-name": pkg.name,
      "release-type": "node",
    });
    expect(manifest).toEqual({ ".": pkg.version });
    const registered = JSON.parse(
      readRepositoryFile(".agents/validation.json"),
    ).externalWorkflows;
    for (const [name, mode] of [
      ["codeql", "security"],
      ["dast", "manual"],
      ["release", "manual"],
    ])
      expect(registered).toContainEqual({
        path: `.github/workflows/${name}.yml`,
        mode,
      });
  });

  it.each(optionalWorkflows)(
    "$name resolves its npm commands and keeps its test gate blocking",
    ({ name, job, script }) => {
      const workflow = readWorkflow(name);
      const scripts = JSON.parse(readRepositoryFile("package.json")).scripts;
      const suite = workflow.jobs[job];
      const steps = suite.steps;
      const testStep = steps.find((step) => step.run === `npm run ${script}`);

      expect(suite.if).toBeUndefined();
      expect(suite["continue-on-error"]).toBeUndefined();
      expect(testStep).toBeDefined();
      expect(testStep.if).toBeUndefined();
      expect(testStep["continue-on-error"]).toBeUndefined();
      expect(scripts[script]).toBeTruthy();
      for (const step of steps) {
        for (const [, command] of (step.run ?? "").matchAll(
          /\bnpm run ([\w:-]+)/g,
        )) {
          expect(scripts[command], `${name}: ${command}`).toBeTruthy();
        }
      }
      const checkout = steps.find((step) =>
        step.uses?.startsWith("actions/checkout@"),
      );
      expect(checkout.with).toMatchObject({
        ref: "${{ github.sha }}",
        "persist-credentials": false,
      });
      const nodeIndex = steps.findIndex((step) =>
        step.uses?.startsWith("actions/setup-node@"),
      );
      const installIndex = steps.findIndex(
        (step) => step.run === "npm ci --strict-peer-deps --no-audit --no-fund",
      );
      expect(nodeIndex).toBeGreaterThanOrEqual(0);
      expect(installIndex).toBeGreaterThan(nodeIndex);
      expect(steps.indexOf(testStep)).toBeGreaterThan(installIndex);
    },
  );

  it("keeps mutation scheduled/manual and deployed checks manual only", () => {
    const mutation = readWorkflow("mutation");
    expect(Object.keys(mutation.on).sort()).toEqual([
      "schedule",
      "workflow_dispatch",
    ]);
    expect(mutation.on.schedule).toHaveLength(1);
    expect(mutation.on.schedule[0].cron).toBeTruthy();
    for (const name of ["staging", "deployment-smoke"]) {
      const workflow = readWorkflow(name);
      expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
      expect(
        workflow.on.workflow_dispatch.inputs.application_url,
      ).toMatchObject({
        required: true,
        type: "string",
      });
      expect(workflow.on.workflow_dispatch.inputs.api_health_url).toMatchObject(
        {
          required: true,
          type: "string",
        },
      );
    }
  });

  it("preserves ordinary PR/main validation without running remote or mutation suites", () => {
    const workflow = readWorkflow("ci");
    const manifest = JSON.parse(readRepositoryFile(".agents/validation.json"));
    expect(workflow.on.push.branches).toContain("main");
    expect(workflow.on.pull_request.types).toEqual(
      expect.arrayContaining(["opened", "synchronize", "ready_for_review"]),
    );
    expect(workflow.on.pull_request.paths).toBeUndefined();
    expect(workflow.on.pull_request["paths-ignore"]).toBeUndefined();
    expect(manifest.profiles.full).toHaveLength(18);
    const ordinaryCommands = manifest.profiles.full.map(
      (id) => manifest.checks.find((check) => check.id === id).command,
    );
    const workflowCommands = Object.values(workflow.jobs).flatMap((job) =>
      job.steps.map((step) => step.run ?? ""),
    );
    for (const { script } of optionalWorkflows) {
      expect(ordinaryCommands).not.toContain(`npm run ${script}`);
      expect(workflowCommands.join("\n")).not.toContain(`npm run ${script}`);
    }
  });

  it.each([
    { name: "staging", job: "validate", mode: "staging" },
    { name: "deployment-smoke", job: "smoke", mode: "smoke" },
  ])(
    "$name rejects unsafe targets before dependencies, browsers or the suite",
    ({ name, job, mode }) => {
      const suite = readWorkflow(name).jobs[job];
      const steps = suite.steps;
      const prefix = mode.toUpperCase();
      for (const target of ["API", "APP"]) {
        expect(suite.env[`${prefix}_ALLOWED_${target}_HOST`]).toBe(
          `\${{ vars.${prefix}_ALLOWED_${target}_HOST }}`,
        );
      }
      expect(suite.env[`${prefix}_BASE_URL`]).toBe(
        "${{ inputs.application_url }}",
      );
      expect(suite.env[`${prefix}_API_HEALTH_URL`]).toBe(
        "${{ inputs.api_health_url }}",
      );
      const guardIndex = steps.findIndex(
        (step) =>
          step.run === `node scripts/validate-workflow-targets.mjs ${mode}`,
      );
      const nodeIndex = steps.findIndex((step) =>
        step.uses?.startsWith("actions/setup-node@"),
      );
      const installIndex = steps.findIndex((step) =>
        step.run?.startsWith("npm ci "),
      );
      const browserIndex = steps.findIndex((step) =>
        step.run?.startsWith("npx playwright install "),
      );
      const testIndex = steps.findIndex(
        (step) => step.run === `npm run test:${mode}`,
      );
      expect(guardIndex).toBeGreaterThan(nodeIndex);
      expect(installIndex).toBeGreaterThan(guardIndex);
      expect(browserIndex).toBeGreaterThan(installIndex);
      expect(testIndex).toBeGreaterThan(browserIndex);
      for (const index of [guardIndex, installIndex, browserIndex, testIndex]) {
        expect(steps[index].if).toBeUndefined();
        expect(steps[index]["continue-on-error"]).toBeUndefined();
      }
      const scripts = JSON.parse(readRepositoryFile("package.json")).scripts;
      expect(scripts[`test:${mode}`]).toBe(
        `playwright test --config ${mode}.config.ts`,
      );
      const config = readRepositoryFile(`${mode}.config.ts`);
      expect(config).toContain(`globalSetup: "./${mode}/setup.ts"`);
      expect(config).toContain("forbidOnly: true");
      expect(existsSync(new URL(`../${mode}/setup.ts`, import.meta.url))).toBe(
        true,
      );
    },
  );

  it.each([
    { name: "staging", job: "validate", mode: "staging" },
    { name: "deployment-smoke", job: "smoke", mode: "smoke" },
  ])(
    "$name uploads its actual configured reports from coverage only",
    async ({ name, job, mode }) => {
      vi.stubEnv(`${mode.toUpperCase()}_BASE_URL`, staging.STAGING_BASE_URL);
      const config =
        mode === "staging"
          ? (await import("../staging.config.ts")).default
          : (await import("../smoke.config.ts")).default;
      const htmlReporter = config.reporter.find(
        ([reporter]) => reporter === "html",
      );
      const generated = [config.outputDir, htmlReporter[1].outputFolder];
      const coverageRoot = fileURLToPath(
        new URL("../coverage/", import.meta.url),
      );
      for (const directory of generated) {
        const relative = path.relative(
          coverageRoot,
          fileURLToPath(new URL(`../${directory}`, import.meta.url)),
        );
        expect(relative).not.toBe("");
        expect(path.isAbsolute(relative)).toBe(false);
        expect(relative.split(path.sep)).not.toContain("..");
      }
      const upload = readWorkflow(name).jobs[job].steps.find((step) =>
        step.uses?.startsWith("actions/upload-artifact@"),
      );
      expect(upload.with.path.trim().split(/\r?\n/).sort()).toEqual(
        generated.toSorted(),
      );
    },
  );

  it.each([
    {
      name: "staging application host",
      mode: "staging",
      env: { ...staging, STAGING_BASE_URL: "https://unapproved.example.com" },
      error: "STAGING_BASE_URL host is not explicitly allowed",
    },
    {
      name: "staging API host",
      mode: "staging",
      env: {
        ...staging,
        STAGING_API_HEALTH_URL: "https://unapproved.example.com/health",
      },
      error: "STAGING_API_HEALTH_URL host is not explicitly allowed",
    },
    {
      name: "smoke application host",
      mode: "smoke",
      env: { ...smoke, SMOKE_BASE_URL: "https://unapproved.example.com" },
      error: "SMOKE_BASE_URL host is not explicitly allowed",
    },
    {
      name: "smoke API host",
      mode: "smoke",
      env: {
        ...smoke,
        SMOKE_API_HEALTH_URL: "https://unapproved.example.com/health",
      },
      error: "SMOKE_API_HEALTH_URL host is not explicitly allowed",
    },
    {
      name: "smoke release identity",
      mode: "smoke",
      env: { ...smoke, SMOKE_DEPLOYMENT_ID: "unapproved-release" },
      error: "do not match the expected deployment",
    },
  ])(
    "direct setup rejects $name without networking",
    async ({ mode, env, error }) => {
      for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
      const blockNetwork = () => {
        throw new Error(
          "Network must remain unavailable during target validation",
        );
      };
      const network = [
        vi.spyOn(globalThis, "fetch").mockImplementation(blockNetwork),
        vi.spyOn(http, "request").mockImplementation(blockNetwork),
        vi.spyOn(http, "get").mockImplementation(blockNetwork),
        vi.spyOn(https, "request").mockImplementation(blockNetwork),
        vi.spyOn(https, "get").mockImplementation(blockNetwork),
        vi
          .spyOn(net.Socket.prototype, "connect")
          .mockImplementation(blockNetwork),
      ];
      const setup =
        mode === "staging"
          ? (await import("../staging/setup.ts")).default
          : (await import("../smoke/setup.ts")).default;
      await expect(Promise.resolve().then(setup)).rejects.toThrow(error);
      for (const spy of network) expect(spy).not.toHaveBeenCalled();
    },
  );

  it.each([
    { mode: "staging", env: staging },
    { mode: "smoke", env: smoke },
  ])(
    "direct $mode setup accepts synthetic authorized targets",
    async ({ mode, env }) => {
      for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
      const setup =
        mode === "staging"
          ? (await import("../staging/setup.ts")).default
          : (await import("../smoke/setup.ts")).default;
      await expect(Promise.resolve().then(setup)).resolves.toBeUndefined();
    },
  );
});
