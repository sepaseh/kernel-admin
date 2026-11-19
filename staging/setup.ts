import { validateStagingTargets } from "../scripts/validate-workflow-targets.mjs";

export default function setupStaging() {
  validateStagingTargets(process.env);
}
