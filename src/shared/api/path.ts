export const encodeIdPathSegment = (id: string): string => {
  if (!id || id === "." || id === "..") {
    throw new TypeError(
      "A resource identifier must be a nonempty path segment.",
    );
  }

  return encodeURIComponent(id);
};
