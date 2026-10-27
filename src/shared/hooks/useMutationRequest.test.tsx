// @vitest-environment jsdom
import { act, render, renderHook, screen } from "@testing-library/react";
import { CanceledError } from "axios";
import { startTransition, StrictMode, Suspense, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { clearAccessToken, setAccessToken } from "@/shared/api/token.ts";

import {
  isCurrentMutationError,
  useMutationRequest,
} from "./useMutationRequest";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
};

describe("mutation request ownership", () => {
  it.each(["identity", "permission"])(
    "keeps the visible operation valid during an abandoned %s render",
    async (change) => {
      const response = deferred<string>();
      const suspended = new Promise<void>(() => undefined);
      const attempted = vi.fn();
      let transition!: () => void;
      let work!: Promise<
        { data: string; isCurrent: () => boolean } | undefined
      >;
      const Consumer = ({ changing }: { changing: boolean }) => {
        const mutation = useMutationRequest(
          changing && change === "identity" ? "new" : "visible",
          !(changing && change === "permission"),
        );
        if (changing) {
          attempted();
          throw suspended;
        }
        return (
          <button
            onClick={() => {
              work = mutation.run(() => response.promise);
            }}
          >
            Save visible record
          </button>
        );
      };
      const Harness = () => {
        const [changing, setChanging] = useState(false);
        transition = () => startTransition(() => setChanging(true));
        return (
          <Suspense fallback={<span>Waiting</span>}>
            <Consumer changing={changing} />
          </Suspense>
        );
      };
      render(<Harness />);
      act(() =>
        screen.getByRole("button", { name: "Save visible record" }).click(),
      );
      await act(async () => transition());
      expect(attempted).toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Save visible record" }),
      ).toBeVisible();
      await act(async () => response.resolve("saved visible record"));
      const accepted = await work;
      expect(accepted?.data).toBe("saved visible record");
      expect(accepted?.isCurrent()).toBe(true);
    },
  );
  it("reserves pending intent synchronously and accepts a void response", async () => {
    const response = deferred<void>();
    const operation = vi.fn(() => response.promise);
    const { result } = renderHook(() => useMutationRequest("form"), {
      wrapper: StrictMode,
    });
    let first!: ReturnType<typeof result.current.run<void>>;
    let duplicate!: ReturnType<typeof result.current.run<void>>;
    act(() => {
      first = result.current.run(operation);
      duplicate = result.current.run(operation);
    });
    expect(result.current.submitting).toBe(true);
    expect(operation).toHaveBeenCalledOnce();
    await expect(duplicate).resolves.toBeUndefined();
    await act(async () => response.resolve());
    await expect(first).resolves.toMatchObject({
      data: undefined,
      isCurrent: expect.any(Function),
    });
    expect(result.current.submitting).toBe(false);
  });

  it.each(["identity", "permission", "session", "unmount"])(
    "ignores old success after %s changes even when transport ignores abort",
    async (change) => {
      const response = deferred<string>();
      let signal!: AbortSignal;
      const { result, rerender, unmount } = renderHook(
        ({ identity, enabled }) => useMutationRequest(identity, enabled),
        { initialProps: { identity: "record-1", enabled: true } },
      );
      let work!: ReturnType<typeof result.current.run<string>>;
      act(() => {
        work = result.current.run((value) => {
          signal = value;
          return response.promise;
        });
      });
      if (change === "identity")
        rerender({ identity: "record-2", enabled: true });
      if (change === "permission")
        rerender({ identity: "record-1", enabled: false });
      if (change === "session") act(() => clearAccessToken());
      if (change === "unmount") unmount();
      if (change !== "session") expect(signal.aborted).toBe(true);
      await act(async () => response.resolve("obsolete"));
      await expect(work).resolves.toBeUndefined();
    },
  );

  it("cancels immediately and lets newer work survive an old completion", async () => {
    const older = deferred<string>();
    const newer = deferred<string>();
    const { result } = renderHook(() => useMutationRequest("upload"));
    let first!: ReturnType<typeof result.current.run<string>>;
    let second!: ReturnType<typeof result.current.run<string>>;
    act(() => {
      first = result.current.run(() => older.promise);
      result.current.cancel();
      second = result.current.run(() => newer.promise);
    });
    await act(async () => older.resolve("old id"));
    await expect(first).resolves.toBeUndefined();
    expect(result.current.submitting).toBe(true);
    await act(async () => newer.resolve("new id"));
    await expect(second).resolves.toMatchObject({
      data: "new id",
      isCurrent: expect.any(Function),
    });
    expect(result.current.submitting).toBe(false);
  });

  it("rejects retained callbacks for a previous record or session", async () => {
    const operation = vi.fn(async () => "not sent");
    const { result, rerender } = renderHook(
      ({ identity }) => useMutationRequest(identity),
      { initialProps: { identity: "old" } },
    );
    const oldRun = result.current.run;
    rerender({ identity: "new" });
    await expect(oldRun(operation)).resolves.toBeUndefined();
    const previousSessionRun = result.current.run;
    setAccessToken("new synthetic session");
    await expect(previousSessionRun(operation)).resolves.toBeUndefined();
    expect(operation).not.toHaveBeenCalled();
  });

  it.each(["identity", "permission"])(
    "never revives an old callback after a committed %s round trip",
    async (change) => {
      const operation = vi.fn(async () => "must not be sent");
      const { result, rerender } = renderHook(
        ({ identity, enabled }) => useMutationRequest(identity, enabled),
        { initialProps: { identity: "A", enabled: true } },
      );
      const oldRun = result.current.run;
      rerender({
        identity: change === "identity" ? "B" : "A",
        enabled: change !== "permission",
      });
      rerender({ identity: "A", enabled: true });
      await act(async () => {
        await expect(oldRun(operation)).resolves.toBeUndefined();
      });
      expect(operation).not.toHaveBeenCalled();
    },
  );

  it("invalidates an accepted response before a caller continues after cancellation or a newer request", async () => {
    const { result } = renderHook(() => useMutationRequest("form"));
    let accepted: Awaited<ReturnType<typeof result.current.run<string>>>;
    await act(async () => {
      accepted = await result.current.run(async () => "saved");
    });
    expect(accepted?.isCurrent()).toBe(true);
    act(() => result.current.cancel());
    expect(accepted?.isCurrent()).toBe(false);
    await act(async () => {
      accepted = await result.current.run(async () => "next saved");
    });
    expect(accepted?.isCurrent()).toBe(true);
    await act(async () => {
      await result.current.run(async () => "newer saved");
    });
    expect(accepted?.isCurrent()).toBe(false);
  });

  it("surfaces current errors for retry and keeps cancellation silent", async () => {
    const { result } = renderHook(() => useMutationRequest("form"));
    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw new Error("Offline");
        }),
      ).rejects.toThrow("Offline");
    });
    expect(result.current.submitting).toBe(false);
    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw new CanceledError();
        }),
      ).resolves.toBeUndefined();
    });
    await act(async () => {
      await expect(
        result.current.run(async () => "retried"),
      ).resolves.toMatchObject({
        data: "retried",
      });
    });
  });

  it("lets callers reject an error invalidated after the hook rethrows it", async () => {
    const { result } = renderHook(() => useMutationRequest("form"));
    const original = new Error("Offline");
    let failure: unknown;
    await act(async () => {
      try {
        await result.current.run(async () => {
          throw original;
        });
      } catch (error) {
        failure = error;
      }
    });
    expect(isCurrentMutationError(failure)).toBe(true);
    expect(failure).toHaveProperty("cause", original);
    act(() => result.current.cancel());
    expect(isCurrentMutationError(failure)).toBe(false);
    expect(isCurrentMutationError(original)).toBe(false);
  });
});
