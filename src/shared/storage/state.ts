export const getState = <T>(key: string, initialValue: T): T => {
  let value: ReturnType<Storage["getItem"]>;
  try {
    value = localStorage.getItem(key);
  } catch {
    return initialValue;
  }
  if (value === null) return initialValue;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
};

export const setState = <T>(key: string, value: T): void => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("State value is not JSON-serializable");
  }

  try {
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.warn("Could not persist browser state.", error);
  }
};
