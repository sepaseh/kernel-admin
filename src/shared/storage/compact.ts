import { storageKeys } from "../config/constants.ts";
import { getState, setState } from "./state";

const defaultCompact = false;

export const getCompact = () => {
  const stored = getState<unknown>(storageKeys.compact, defaultCompact);
  return typeof stored === "boolean" ? stored : defaultCompact;
};

export const setCompact = (compact: boolean) => {
  setState(storageKeys.compact, compact);
};
