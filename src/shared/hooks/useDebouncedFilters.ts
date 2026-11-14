import { useCallback, useEffect, useRef } from "react";

export const useDebouncedFilters = <T>(setFilters: (filters: T) => void) => {
  const timeout = useRef<number | undefined>(undefined);

  const cancel = useCallback(() => {
    window.clearTimeout(timeout.current);
    timeout.current = undefined;
  }, []);

  const schedule = useCallback(
    (filters: T) => {
      cancel();
      timeout.current = window.setTimeout(() => {
        timeout.current = undefined;
        setFilters(filters);
      }, 500);
    },
    [cancel, setFilters],
  );

  useEffect(() => cancel, [cancel, setFilters]);

  return schedule;
};
