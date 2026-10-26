const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const toCamel = (value: string) =>
  value.replace(/([-_][a-z])/gi, ($1) =>
    $1.toUpperCase().replace("-", "").replace("_", ""),
  );

const toSnake = (value: string) =>
  value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const toCamelCase = <T>(obj: T): T => {
  if (isObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => [toCamel(key), toCamelCase(value)]),
    ) as T;
  } else if (isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as T;
  }
  return obj;
};

export const toSnakeCase = <T>(obj: T): T => {
  if (isObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => [toSnake(key), toSnakeCase(value)]),
    ) as T;
  } else if (isArray(obj)) {
    return obj.map((item) => toSnakeCase(item)) as T;
  }
  return obj;
};
