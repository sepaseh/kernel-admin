import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import { useReadRequest } from "./useReadRequest.ts";

export const useReadResource = <T>(
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) => {
  const { cancel, data, error, key, loading, replace, run } =
    useReadRequest<T>();
  const identity = useMemo(() => ({ enabled, load }), [enabled, load]);
  const committed = useRef<typeof identity | undefined>(undefined);
  const reload = useCallback(
    () =>
      enabled && committed.current === identity
        ? run(load, load)
        : Promise.resolve(undefined),
    [enabled, identity, load, run],
  );
  const accept = useCallback(
    (value: T) => {
      if (committed.current === identity) replace(value, load);
    },
    [identity, load, replace],
  );

  useLayoutEffect(() => {
    committed.current = identity;
    return () => {
      committed.current = undefined;
      cancel();
    };
  }, [cancel, identity]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const current = key === load;
  return {
    data: enabled && current ? data : undefined,
    error: enabled && current ? error : undefined,
    loading: enabled && (!current || loading),
    reload,
    replace: accept,
  };
};
