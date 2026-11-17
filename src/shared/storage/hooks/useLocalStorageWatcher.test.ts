// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { storageKeys } from "@/shared/config";

import { useLocalStorageWatcher } from "./useLocalStorageWatcher";

afterEach(cleanup);

const dispatch = (key: string | null, storageArea: Storage = localStorage) => {
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key, storageArea }));
  });
};

describe("cross-tab preference updates", () => {
  it("accepts its key and clear events from local storage only", () => {
    const callback = vi.fn();
    renderHook(() => useLocalStorageWatcher(storageKeys.theme, callback));

    dispatch(storageKeys.compact);
    dispatch(storageKeys.theme, sessionStorage);
    expect(callback).not.toHaveBeenCalled();

    dispatch(storageKeys.theme);
    dispatch(null);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("uses the current callback/key and removes its listener on unmount", () => {
    const previous = vi.fn();
    const current = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ key, callback }) => useLocalStorageWatcher(key, callback),
      {
        initialProps: {
          key: storageKeys.theme as (typeof storageKeys)[keyof typeof storageKeys],
          callback: previous,
        },
      },
    );

    rerender({ key: storageKeys.compact, callback: current });
    dispatch(storageKeys.theme);
    dispatch(storageKeys.compact);
    expect(previous).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledOnce();

    unmount();
    dispatch(storageKeys.compact);
    expect(current).toHaveBeenCalledOnce();
  });
});
