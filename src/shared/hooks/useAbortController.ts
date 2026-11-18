import { useCallback, useEffect, useRef } from "react";

export const useAbortController = () => {
  const controller = useRef<AbortController | undefined>(undefined);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = undefined;
  }, []);

  const start = useCallback(() => {
    cancel();
    controller.current = new AbortController();
    return controller.current.signal;
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { cancel, start };
};
