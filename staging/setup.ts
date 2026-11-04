import { createRequire } from "node:module";

const { validateStagingTargets } = createRequire(import.meta.url)(
  "../scripts/validate-workflow-targets.mjs",
) as { validateStagingTargets: (environment: NodeJS.ProcessEnv) => void };

export default () => {
  validateStagingTargets(process.env);
};
