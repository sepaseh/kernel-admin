import assert from "node:assert/strict";
import { test } from "node:test";

import { environment } from "./deployment.test-support.mjs";
import { validateDeploymentEnv } from "./validate-deployment-env.mjs";

test("public configuration rejects malformed origins, paths and release identifiers", () => {
  assert.equal(validateDeploymentEnv(environment).basePath, "/console/");
  for (const patch of [
    { VITE_API_BASE_URL: "http://public.example.com" },
    { VITE_API_BASE_URL: "https://user:pass@api.example.com" },
    { VITE_APP_BASE_URL: "/../" },
    { VITE_APP_BASE_URL: "/console" },
    { VITE_RELEASE_ID: "../release" },
  ])
    assert.throws(() => validateDeploymentEnv({ ...environment, ...patch }));
  assert.doesNotThrow(() =>
    validateDeploymentEnv({
      ...environment,
      VITE_OBSERVABILITY_URL: "https://observe.example.com/events",
    }),
  );
});
