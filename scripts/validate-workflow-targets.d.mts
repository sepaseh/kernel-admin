type StagingTargetLabels = {
  allowedApiHost: string;
  allowedAppHost: string;
  apiHealthUrl: string;
  baseUrl: string;
};

export function parseConfiguredHostname(
  name: string,
  rawValue: string | undefined,
): string;

export function parseTarget(name: string, rawValue: string | undefined): URL;

export function validateDastTarget(environment: NodeJS.ProcessEnv): void;

export function validateSmokeTargets(environment: NodeJS.ProcessEnv): void;

export function validateStagingTargets(
  environment: NodeJS.ProcessEnv,
  labels?: StagingTargetLabels,
): void;
