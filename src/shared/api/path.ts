export const encodeIdPathSegment = (id: string): string => {
  if (!id || id === "." || id === "..")
    throw new Error(i18nInstance.t("unexpectedError"));

  return encodeURIComponent(id);
};
