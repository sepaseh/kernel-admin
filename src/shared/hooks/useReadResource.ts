import { useCallback, useEffect } from "react";

import { useReadRequest } from "./useReadRequest.ts";

export const useReadResource = <T>(
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) => {
  const { cancel, data, error, key, loading, replace, run } =
    useReadRequest<T>();
  const reload = useCallback(
    () => (enabled ? run(load, load) : Promise.resolve(undefined)),
    [enabled, load, run],
  );
  const accept = useCallback(
    (value: T) => replace(value, load),
    [load, replace],
  );

  useEffect(() => {
    void reload();
    return cancel;
  }, [cancel, reload]);

  const current = key === load;
  return {
    data: enabled && current ? data : undefined,
    error: enabled && current ? error : undefined,
    loading: enabled && (!current || loading),
    reload,
    replace: accept,
  };
};
