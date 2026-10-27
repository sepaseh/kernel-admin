// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { CanceledError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReadRequest } from "./useReadRequest.ts";
import { useReadResource } from "./useReadResource.ts";

afterEach(() => cleanup());

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
};

describe("read request lifecycle", () => {
  it("settles a cancelled detail without replacement and permits a fresh retry", async () => {
    const pending = deferred<string>();
    const { result } = renderHook(() => useReadRequest<string>());
    let original!: Promise<string | undefined>;
    act(() => {
      original = result.current.run(() => pending.promise);
    });
    expect(result.current.loading).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.loading).toBe(false);
    await act(async () => {
      await result.current.run(async () => "retried detail");
    });
    expect(result.current.data).toBe("retried detail");
    await act(async () => pending.resolve("cancelled detail"));
    await expect(original).resolves.toBeUndefined();
    expect(result.current.data).toBe("retried detail");
    expect(result.current.error).toBeUndefined();
  });
  it("does not commit an older filter response even if its adapter ignores cancellation", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const older = vi.fn<(signal: AbortSignal) => Promise<string>>(
      () => first.promise,
    );
    const newer = vi.fn<(signal: AbortSignal) => Promise<string>>(
      () => second.promise,
    );
    const { result, rerender } = renderHook(
      ({ load }) => useReadResource(load),
      { initialProps: { load: older } },
    );
    rerender({ load: newer });
    expect(older.mock.calls[0][0].aborted).toBe(true);
    await act(async () => second.resolve("new filter"));
    expect(result.current.data).toBe("new filter");
    await act(async () => first.resolve("old filter"));
    expect(result.current.data).toBe("new filter");
    expect(result.current.loading).toBe(false);
  });

  it("retains successful data on refresh failure and allows explicit retry without stale errors", async () => {
    const load = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockResolvedValueOnce("last success")
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce("fresh success");
    const { result } = renderHook(() => useReadResource(load));
    await waitFor(() => expect(result.current.data).toBe("last success"));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toBe("last success");
    expect(result.current.error).toHaveProperty("message", "Offline");
    expect(result.current.loading).toBe(false);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toBe("fresh success");
    expect(result.current.error).toBeUndefined();
  });

  it("aborts pending reads on refetch/unmount and never returns an obsolete detail to its caller", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    let firstSignal!: AbortSignal;
    let secondSignal!: AbortSignal;
    const { result, unmount } = renderHook(() => useReadRequest<string>());
    let oldRequest!: Promise<string | undefined>;
    let newRequest!: Promise<string | undefined>;
    act(() => {
      oldRequest = result.current.run((signal) => {
        firstSignal = signal;
        return first.promise;
      });
    });
    act(() => {
      newRequest = result.current.run((signal) => {
        secondSignal = signal;
        return second.promise;
      });
    });
    expect(firstSignal.aborted).toBe(true);
    await act(async () => first.resolve("old drawer"));
    await expect(oldRequest).resolves.toBeUndefined();
    expect(result.current.loading).toBe(true);
    unmount();
    expect(secondSignal.aborted).toBe(true);
    second.resolve("unmounted drawer");
    await expect(newRequest).resolves.toBeUndefined();
  });

  it("an accepted mutation result invalidates an older settings read", async () => {
    const pending = deferred<string>();
    const load = vi.fn<(signal: AbortSignal) => Promise<string>>(
      () => pending.promise,
    );
    const { result } = renderHook(() => useReadResource(load));
    act(() => result.current.replace("saved settings"));
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => pending.resolve("previous settings"));
    expect(result.current.data).toBe("saved settings");
  });

  it("does not expose cancellation as an error or leave the consumer busy", async () => {
    const load = vi.fn().mockRejectedValue(new CanceledError());
    const { result } = renderHook(() => useReadResource(load));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeUndefined();
  });

  it("cleans up both StrictMode effect passes and ignores the obsolete rejection", async () => {
    const calls: {
      signal: AbortSignal;
      pending: ReturnType<typeof deferred<string>>;
    }[] = [];
    const load = (signal: AbortSignal) => {
      const pending = deferred<string>();
      calls.push({ signal, pending });
      return pending.promise;
    };
    const { result, unmount } = renderHook(() => useReadResource(load), {
      reactStrictMode: true,
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    await act(async () =>
      calls[0].pending.reject(new Error("obsolete failure")),
    );
    expect(result.current.error).toBeUndefined();
    await act(async () => calls[1].pending.resolve("active pass"));
    expect(result.current.data).toBe("active pass");
    let request!: Promise<string | undefined>;
    act(() => {
      request = result.current.reload();
    });
    unmount();
    expect(calls[2].signal.aborted).toBe(true);
    calls[2].pending.resolve("after unmount");
    await expect(request).resolves.toBeUndefined();
  });
});
