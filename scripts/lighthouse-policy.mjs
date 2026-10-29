import { validateBasePath } from "./validate-deployment-env.mjs";

export const lighthouseThresholds = {
  "cumulative-layout-shift": 0.2,
  "first-contentful-paint": 6_000,
  interactive: 7_000,
  "largest-contentful-paint": 6_500,
  "total-blocking-time": 600,
};
export const minimumPerformanceScore = 0.6;

export const createLighthouseUrl = (appBasePath = "/") => {
  return new URL(
    `${validateBasePath(appBasePath)}auth`,
    "http://127.0.0.1:4174",
  ).href;
};

export const evaluateLighthouseReport = (lhr) => {
  const failures = [];
  const performanceScore = lhr?.categories?.performance?.score;
  if (
    !Number.isFinite(performanceScore) ||
    performanceScore < 0 ||
    performanceScore > 1
  )
    failures.push(
      "performance score unavailable (expected a finite number between 0 and 1)",
    );
  else if (performanceScore < minimumPerformanceScore)
    failures.push(
      `performance score ${(performanceScore * 100).toFixed(2)} (minimum ${(minimumPerformanceScore * 100).toFixed(2)})`,
    );
  for (const [auditId, maximum] of Object.entries(lighthouseThresholds)) {
    const value = lhr?.audits?.[auditId]?.numericValue;
    const available = Number.isFinite(value) && value >= 0;
    if (!available || value > maximum)
      failures.push(
        `${auditId} ${available ? value.toFixed(2) : "unavailable"} (maximum ${maximum})`,
      );
  }
  if (failures.length)
    throw new Error(
      `Lighthouse advisory thresholds exceeded:\n${failures.join("\n")}`,
    );

  return Math.round(performanceScore * 100);
};
