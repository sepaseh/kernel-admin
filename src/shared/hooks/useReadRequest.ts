import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

type Snapshot<T> = {
  data?: T;
  error?: unknown;
  key?: unknown;
  loading: boolean;
};

/** A read's result belongs to its current key and mounted consumer, even if an
 * adapter ignores AbortSignal or its response completed before cancellation. */
export const useReadRequest = <T>() => {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ loading: false });
  const mounted = useRef(false);
  const sequence = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);

  const cancel = useCallback(() => {
    sequence.current += 1;
    controller.current?.abort();
    controller.current = undefined;
    if (mounted.current)
      setSnapshot((previous) =>
        previous.loading ? { ...previous, loading: false } : previous,
      );
  }, []);

  const replace = useCallback(
    (data: T, key: unknown) => {
      cancel();
      if (mounted.current) setSnapshot({ data, key, loading: false });
    },
    [cancel],
  );

  const run = useCallback(
    async (
      load: (signal: AbortSignal) => Promise<T>,
      key: unknown = load,
    ): Promise<T | undefined> => {
      if (!mounted.current) return;
      cancel();
      const current = sequence.current;
      const pending = new AbortController();
      controller.current = pending;
      setSnapshot((previous) => ({
        data: previous.key === key ? previous.data : undefined,
        error: previous.key === key ? previous.error : undefined,
        key,
        loading: true,
      }));
      const isCurrent = () =>
        mounted.current &&
        sequence.current === current &&
        !pending.signal.aborted;
      try {
        const data = await load(pending.signal);
        if (!isCurrent()) return;
        setSnapshot({ data, key, loading: false });
        return data;
      } catch (error) {
        if (!isCurrent()) return;
        setSnapshot((previous) => ({
          data: previous.key === key ? previous.data : undefined,
          error: axios.isCancel(error) ? undefined : error,
          key,
          loading: false,
        }));
      } finally {
        if (sequence.current === current) controller.current = undefined;
      }
    },
    [cancel],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);

  return { ...snapshot, cancel, replace, run };
};
