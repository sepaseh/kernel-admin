import { validateSmokeTargets } from "../scripts/validate-workflow-targets.mjs";

export default function setupSmoke() {
  validateSmokeTargets(process.env);
}
