import { useEffect } from "react";

import type { storageKeys } from "@/shared/config";

export const useLocalStorageWatcher = (
  key: (typeof storageKeys)[keyof typeof storageKeys],
  callback: () => void,
) => {
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === key || event.key === null) callback();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, callback]);
};
