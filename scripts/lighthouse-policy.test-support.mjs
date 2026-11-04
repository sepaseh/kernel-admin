import {
  lighthouseThresholds,
  minimumPerformanceScore,
} from "./lighthouse-policy.mjs";

export const createReport = ({
  audits = {},
  score = minimumPerformanceScore,
} = {}) => ({
  audits: Object.fromEntries(
    Object.entries(lighthouseThresholds).map(([auditId, maximum]) => [
      auditId,
      { numericValue: audits[auditId] ?? maximum },
    ]),
  ),
  categories: { performance: { score } },
});
