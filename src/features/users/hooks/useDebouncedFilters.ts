import { useCallback, useEffect, useRef } from "react";

import type { UserListQuery } from "@/features/users/types";

import type { useFilterParams } from "./useFilterParams";

type SetFilters = ReturnType<
  typeof useFilterParams<UserListQuery>
>["setFilters"];

export const useDebouncedFilters = (setFilters: SetFilters) => {
  const timeout = useRef<Parameters<typeof window.clearTimeout>[0]>(undefined);
  const cancel = useCallback(() => {
    window.clearTimeout(timeout.current);
    timeout.current = undefined;
  }, []);
  const schedule = useCallback(
    (filters: Partial<UserListQuery>) => {
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
