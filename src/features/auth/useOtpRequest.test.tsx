import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deferred } from "@/test/deferred";

import type { OtpRequestParams, OtpRequestProps } from "./types";
import { useOtpRequest } from "./useOtpRequest";

const { requestOtp } = vi.hoisted(() => ({
  requestOtp:
    vi.fn<
      (
        params: OtpRequestParams,
        signal?: AbortSignal,
      ) => Promise<OtpRequestProps>
    >(),
}));
vi.mock("./api", () => ({ requestOtp }));

const setup = () => {
  const form = {
    validateFields: vi.fn().mockResolvedValue({ mobile: "09120000000" }),
    getFieldValue: vi.fn(),
    setFieldValue: vi.fn(),
  };
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(() =>
    useOtpRequest({ form, onError, onSuccess, purpose: "register" }),
  );

  return { ...hook, form, onError, onSuccess };
};

beforeEach(() => {
  requestOtp.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("OTP request intent", () => {
  it("prevents double submission and waits for the server cooldown", async () => {
    vi.useFakeTimers();
    const pending = deferred<{ expiresIn: number; remainingSeconds: number }>();
    requestOtp.mockReturnValue(pending.promise);
    const { result, onSuccess } = setup();

    await act(async () => {
      const first = result.current.handleOtpRequest();
      await result.current.handleOtpRequest();
      pending.resolve({ expiresIn: 120, remainingSeconds: 2.1 });
      await first;
    });

    expect(requestOtp).toHaveBeenCalledTimes(1);
    expect(requestOtp).toHaveBeenCalledWith(
      { mobile: "09120000000", purpose: "register" },
      expect.any(AbortSignal),
    );
    expect(requestOtp.mock.calls[0][1]?.aborted).toBe(false);
    expect(result.current.remainingSeconds).toBe(3);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.handleOtpRequest();
    });
    expect(requestOtp).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(result.current.remainingSeconds).toBe(2);
  });

  it("discards a response after the mobile number changes and clears the previous code", async () => {
    const pending = deferred<{ expiresIn: number; remainingSeconds: number }>();
    requestOtp.mockReturnValue(pending.promise);
    const { result, form, onSuccess, onError } = setup();
    let request!: Promise<void>;
    await act(async () => {
      request = result.current.handleOtpRequest();
    });
    const signal = requestOtp.mock.calls[0][1]!;
    expect(result.current.requestingOtp).toBe(true);

    act(() => {
      result.current.handleValuesChange({ mobile: "09121111111" });
    });
    expect(signal.aborted).toBe(true);
    expect(result.current.requestingOtp).toBe(false);
    await act(async () => {
      pending.resolve({ expiresIn: 120, remainingSeconds: 60 });
      await request;
    });

    expect(form.setFieldValue).toHaveBeenCalledWith("otp", undefined);
    expect(result.current.remainingSeconds).toBe(0);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it.each(["success", "error"] as const)(
    "keeps the replacement request locked when an abandoned request returns %s",
    async (outcome) => {
      const previous = deferred<OtpRequestProps>();
      const replacement = deferred<OtpRequestProps>();
      requestOtp
        .mockReturnValueOnce(previous.promise)
        .mockReturnValueOnce(replacement.promise);
      const { result, form, onSuccess, onError } = setup();
      let first!: Promise<void>;
      let second!: Promise<void>;
      await act(async () => {
        first = result.current.handleOtpRequest();
      });
      const oldSignal = requestOtp.mock.calls[0][1]!;

      act(() => {
        result.current.handleValuesChange({ mobile: "09121111111" });
      });
      form.validateFields.mockResolvedValue({ mobile: "09121111111" });
      await act(async () => {
        second = result.current.handleOtpRequest();
      });
      expect(oldSignal.aborted).toBe(true);
      expect(requestOtp).toHaveBeenNthCalledWith(
        2,
        { mobile: "09121111111", purpose: "register" },
        expect.any(AbortSignal),
      );
      const newSignal = requestOtp.mock.calls[1][1]!;

      await act(async () => {
        if (outcome === "success")
          previous.resolve({ expiresIn: 120, remainingSeconds: 60 });
        else previous.reject(new Error("Synthetic obsolete OTP request"));
        await first;
      });
      expect(result.current.requestingOtp).toBe(true);
      expect(result.current.remainingSeconds).toBe(0);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.handleOtpRequest();
      });
      expect(requestOtp).toHaveBeenCalledTimes(2);
      expect(newSignal.aborted).toBe(false);

      await act(async () => {
        replacement.resolve({ expiresIn: 120, remainingSeconds: 3 });
        await second;
      });
      expect(result.current.requestingOtp).toBe(false);
      expect(result.current.remainingSeconds).toBe(3);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it("does not call the API when mobile validation fails", async () => {
    const { result, form, onError } = setup();
    form.validateFields.mockRejectedValue(
      new Error("Synthetic invalid mobile"),
    );

    await act(async () => {
      await result.current.handleOtpRequest();
    });

    expect(requestOtp).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.requestingOtp).toBe(false);
  });

  it("does not send an OTP after validation completes on an unmounted form", async () => {
    const validation = deferred<{ mobile: string }>();
    const { result, form, unmount, onError, onSuccess } = setup();
    form.validateFields.mockReturnValue(validation.promise);
    let request!: Promise<void>;
    await act(async () => {
      request = result.current.handleOtpRequest();
    });
    expect(result.current.requestingOtp).toBe(true);

    unmount();
    await act(async () => {
      validation.resolve({ mobile: "09120000000" });
      await request;
    });

    expect(requestOtp).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("reports an active request failure and releases the submit state", async () => {
    const error = new Error("Synthetic OTP request failure");
    requestOtp.mockRejectedValue(error);
    const { result, onError, onSuccess } = setup();

    await act(async () => {
      await result.current.handleOtpRequest();
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.requestingOtp).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it.each(["success", "error"] as const)(
    "aborts its request and suppresses late %s callbacks after unmount",
    async (outcome) => {
      const pending = deferred<{
        expiresIn: number;
        remainingSeconds: number;
      }>();
      requestOtp.mockReturnValue(pending.promise);
      const { result, unmount, onError, onSuccess } = setup();
      let request!: Promise<void>;
      await act(async () => {
        request = result.current.handleOtpRequest();
      });
      const signal = requestOtp.mock.calls[0][1];
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal?.aborted).toBe(false);

      unmount();
      expect(signal?.aborted).toBe(true);

      await act(async () => {
        if (outcome === "success") {
          pending.resolve({ expiresIn: 120, remainingSeconds: 60 });
        } else {
          pending.reject(new Error("Synthetic abandoned request"));
        }
        await request;
      });

      expect(onError).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );
});
