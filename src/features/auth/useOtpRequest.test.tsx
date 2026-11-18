// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { CanceledError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestOtp } from "./api.ts";
import type { RegisterParams } from "./types.ts";
import { useOtpRequest } from "./useOtpRequest.ts";

type OtpValues = Pick<RegisterParams, "mobile" | "otp">;
type OtpResponse = Awaited<ReturnType<typeof requestOtp>>;

vi.mock("./api.ts", () => ({ requestOtp: vi.fn() }));

const createOptions = () => {
  let mobile = "09120000000";
  const options = {
    form: {
      getFieldValue: vi.fn(() => mobile),
      setFieldValue: vi.fn(),
      validateFields: vi.fn(async (): Promise<OtpValues> => ({
        mobile,
        otp: "",
      })),
    },
    onError: vi.fn(),
    onSuccess: vi.fn(),
    purpose: "forgot_password" as const,
  };
  return {
    options,
    changeMobile: (value: RegisterParams["mobile"]) => {
      mobile = value;
    },
  };
};

beforeEach(() => {
  vi.mocked(requestOtp)
    .mockReset()
    .mockResolvedValue({ expiresIn: 120, remainingSeconds: 2 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useOtpRequest", () => {
  it("keeps validation errors local and releases the request lock for correction", async () => {
    const { options } = createOptions();
    options.form.validateFields.mockRejectedValueOnce(
      new Error("Invalid mobile"),
    );
    const { result } = renderHook(() => useOtpRequest(options));

    await act(async () => {
      await result.current.handleOtpRequest();
    });
    expect(requestOtp).not.toHaveBeenCalled();
    expect(options.onError).not.toHaveBeenCalled();
    expect(result.current.requestingOtp).toBe(false);

    await act(async () => {
      await result.current.handleOtpRequest();
    });
    expect(requestOtp).toHaveBeenCalledOnce();
    expect(options.onSuccess).toHaveBeenCalledOnce();
  });

  it("rounds a fractional server cooldown up to complete seconds", async () => {
    const { options } = createOptions();
    vi.mocked(requestOtp).mockResolvedValueOnce({
      expiresIn: 120,
      remainingSeconds: 2.1,
    });
    const { result } = renderHook(() => useOtpRequest(options));

    await act(async () => {
      await result.current.handleOtpRequest();
    });

    expect(result.current.remainingSeconds).toBe(3);
  });

  it("discards a reply when a programmatic mobile change bypasses the change callback", async () => {
    const { options, changeMobile } = createOptions();
    let resolve!: (value: OtpResponse) => void;
    vi.mocked(requestOtp).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(() => useOtpRequest(options));
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.handleOtpRequest();
    });
    expect(requestOtp).toHaveBeenCalledOnce();
    changeMobile("09121111111");

    await act(async () => {
      resolve({ expiresIn: 120, remainingSeconds: 30 });
      await pending;
    });

    expect(options.onSuccess).not.toHaveBeenCalled();
    expect(options.onError).not.toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.requestingOtp).toBe(false);
  });

  it("reserves one request before validation and cancels validation work on unmount", async () => {
    const { options } = createOptions();
    let resolve!: (value: OtpValues) => void;
    options.form.validateFields.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result, unmount } = renderHook(() => useOtpRequest(options));

    act(() => {
      result.current.handleOtpRequest();
      result.current.handleOtpRequest();
    });
    expect(options.form.validateFields).toHaveBeenCalledExactlyOnceWith([
      "mobile",
    ]);
    expect(result.current.requestingOtp).toBe(true);
    expect(requestOtp).not.toHaveBeenCalled();

    unmount();
    await act(async () => {
      resolve({ mobile: "09120000000", otp: "" });
    });
    expect(requestOtp).not.toHaveBeenCalled();
    expect(options.onError).not.toHaveBeenCalled();
    expect(options.onSuccess).not.toHaveBeenCalled();
  });

  it("keeps a replacement mobile request pending when an obsolete response arrives", async () => {
    const { options, changeMobile } = createOptions();
    let resolveOld!: (value: OtpResponse) => void;
    let resolveNew!: (value: OtpResponse) => void;
    vi.mocked(requestOtp)
      .mockReturnValueOnce(
        new Promise((done) => {
          resolveOld = done;
        }),
      )
      .mockReturnValueOnce(
        new Promise((done) => {
          resolveNew = done;
        }),
      );
    const { result } = renderHook(() => useOtpRequest(options));
    act(() => {
      result.current.handleOtpRequest();
    });
    await waitFor(() => expect(requestOtp).toHaveBeenCalledOnce());
    const oldSignal = vi.mocked(requestOtp).mock.calls[0][1];

    changeMobile("09121111111");
    act(() => {
      result.current.handleValuesChange({ mobile: "09121111111" });
      result.current.handleOtpRequest();
    });
    await waitFor(() => expect(requestOtp).toHaveBeenCalledTimes(2));
    expect(oldSignal?.aborted).toBe(true);
    expect(options.form.setFieldValue).toHaveBeenCalledWith("otp", "");
    expect(requestOtp).toHaveBeenLastCalledWith(
      { mobile: "09121111111", purpose: "forgot_password" },
      expect.any(AbortSignal),
    );

    await act(async () => {
      resolveOld({ expiresIn: 120, remainingSeconds: 30 });
    });
    expect(result.current.requestingOtp).toBe(true);
    expect(options.onSuccess).not.toHaveBeenCalled();
    await act(async () => {
      resolveNew({ expiresIn: 120, remainingSeconds: 2 });
    });
    expect(result.current.requestingOtp).toBe(false);
    expect(result.current.remainingSeconds).toBe(2);
    expect(options.onSuccess).toHaveBeenCalledOnce();
  });

  it("allows retry after failure and after the server cooldown expires", async () => {
    vi.useFakeTimers();
    const { options } = createOptions();
    const error = new Error("Temporarily offline");
    vi.mocked(requestOtp).mockRejectedValueOnce(error);
    const { result } = renderHook(() => useOtpRequest(options));
    await act(async () => {
      result.current.handleOtpRequest();
    });
    expect(options.onError).toHaveBeenCalledWith(error);
    expect(result.current.requestingOtp).toBe(false);

    await act(async () => {
      result.current.handleOtpRequest();
    });
    expect(options.onSuccess).toHaveBeenCalledOnce();
    expect(result.current.remainingSeconds).toBe(2);
    act(() => {
      result.current.handleOtpRequest();
    });
    expect(requestOtp).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.remainingSeconds).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    await act(async () => {
      result.current.handleOtpRequest();
    });
    expect(requestOtp).toHaveBeenCalledTimes(3);
  });

  it.each(["success", "failure"] as const)(
    "suppresses late OTP %s callbacks after unmount",
    async (outcome) => {
      const { options } = createOptions();
      let resolve!: (value: OtpResponse) => void;
      let reject!: (error: Error) => void;
      vi.mocked(requestOtp).mockReturnValueOnce(
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
      );
      const { result, unmount } = renderHook(() => useOtpRequest(options));
      let pending!: Promise<void>;
      await act(async () => {
        pending = result.current.handleOtpRequest();
      });
      const signal = vi.mocked(requestOtp).mock.calls[0][1];

      unmount();
      expect(signal?.aborted).toBe(true);
      await act(async () => {
        if (outcome === "success")
          resolve({ expiresIn: 120, remainingSeconds: 30 });
        else reject(new Error("Obsolete OTP failure"));
        await pending;
      });

      expect(options.onSuccess).not.toHaveBeenCalled();
      expect(options.onError).not.toHaveBeenCalled();
    },
  );

  it("suppresses a canceled OTP failure and releases the active lock", async () => {
    const { options } = createOptions();
    vi.mocked(requestOtp).mockRejectedValueOnce(new CanceledError());
    const { result } = renderHook(() => useOtpRequest(options));

    await act(async () => {
      await result.current.handleOtpRequest();
    });
    expect(options.onError).not.toHaveBeenCalled();
    expect(result.current.requestingOtp).toBe(false);
    await act(async () => {
      await result.current.handleOtpRequest();
    });
    expect(options.onSuccess).toHaveBeenCalledOnce();
  });
});
