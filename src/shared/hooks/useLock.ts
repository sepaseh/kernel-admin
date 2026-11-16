import { useCallback, useRef } from "react";

export const useLock = () => {
  const locked = useRef(false);

  const lock = useCallback(() => {
    if (locked.current) return false;

    locked.current = true;
    return true;
  }, []);

  const unlock = useCallback(() => {
    locked.current = false;
  }, []);

  return { lock, unlock };
};
