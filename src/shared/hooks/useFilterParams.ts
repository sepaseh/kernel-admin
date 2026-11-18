import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

type FilterParams<T> = Partial<Record<keyof T, string>>;

export const useFilterParams = <T extends object>() => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => Object.fromEntries(searchParams) as FilterParams<T>,
    [searchParams],
  );

  const setFilters = useCallback(
    (newFilters: FilterParams<T>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);

        for (const [key, value] of Object.entries(newFilters)) {
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, String(value));
        }

        return next;
      });
    },
    [setSearchParams],
  );

  return { filters, setFilters };
};
