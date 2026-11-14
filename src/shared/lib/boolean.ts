export const getBoolean = (value?: string): boolean | undefined => {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return undefined;
};
