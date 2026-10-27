import type { FormInstance } from "antd";
import { isCancel } from "axios";
import { useEffect, useRef, useState } from "react";

import { requestOtp } from "./api.ts";
import type { OtpRequestParams, RegisterParams } from "./types.ts";

type OtpFields = Pick<RegisterParams, "mobile" | "otp">;

type OtpRequestOptions = {
  form: Pick<
    FormInstance<OtpFields>,
    "getFieldValue" | "setFieldValue" | "validateFields"
  >;
  onError: (error: unknown) => void;
  onSuccess: () => void;
  purpose: OtpRequestParams["purpose"];
};

export const useOtpRequest = ({
  form,
  onError,
  onSuccess,
  purpose,
}: OtpRequestOptions) => {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const pending = useRef<AbortController | undefined>(undefined);

  const request = async () => {
    if (pending.current || remainingSeconds) return;

    const controller = new AbortController();
    pending.current = controller;
    setRequestingOtp(true);
    try {
      const values = await form
        .validateFields(["mobile"])
        .catch(() => undefined);
      if (!values || controller.signal.aborted) return;
      const { mobile } = values;
      const response = await requestOtp({ mobile, purpose }, controller.signal);
      if (controller.signal.aborted || form.getFieldValue("mobile") !== mobile)
        return;
      setRemainingSeconds(response.remainingSeconds);
      onSuccess();
    } catch (error) {
      if (!controller.signal.aborted && !isCancel(error)) onError(error);
    } finally {
      if (pending.current === controller) {
        pending.current = undefined;
        if (!controller.signal.aborted) setRequestingOtp(false);
      }
    }
  };

  const handleOtpRequest = () => {
    void request();
  };

  const handleValuesChange = (changed: Partial<OtpFields>) => {
    if (!Object.hasOwn(changed, "mobile")) return;
    pending.current?.abort();
    pending.current = undefined;
    setRequestingOtp(false);
    setRemainingSeconds(0);
    form.setFieldValue("otp", "");
  };

  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = undefined;
    },
    [],
  );

  useEffect(() => {
    if (!remainingSeconds) return;
    const timeout = window.setTimeout(
      () => setRemainingSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timeout);
  }, [remainingSeconds]);

  return {
    handleOtpRequest,
    handleValuesChange,
    remainingSeconds,
    requestingOtp,
  };
};
