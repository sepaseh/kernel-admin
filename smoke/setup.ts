import { createRequire } from "node:module";

const { validateSmokeTargets } = createRequire(import.meta.url)(
  "../scripts/validate-workflow-targets.mjs",
) as { validateSmokeTargets: (environment: NodeJS.ProcessEnv) => void };

export default () => {
  validateSmokeTargets(process.env);
};
