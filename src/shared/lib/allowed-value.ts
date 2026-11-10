export const getAllowedValue = <T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
): T | undefined => allowedValues.find((item) => item === value);
