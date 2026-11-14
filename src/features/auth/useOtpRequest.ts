import type { FormInstance } from "antd";
import { isCancel } from "axios";
import { useEffect, useRef, useState } from "react";

import { useAbortController, useLock } from "@/shared/hooks";

import { requestOtp } from "./api";
import type { OtpRequestParams } from "./types";

type OtpRequestProps = {
  form: Pick<
    FormInstance<{ mobile: string; otp: string }>,
    "validateFields" | "getFieldValue" | "setFieldValue"
  >;
  onError: (error: unknown) => void;
  onSuccess: () => void;
  purpose: OtpRequestParams["purpose"];
};

export const useOtpRequest = ({
  form,
  purpose,
  onError,
  onSuccess,
}: OtpRequestProps) => {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const { cancel, start } = useAbortController();
  const { lock, unlock } = useLock();
  const intent = useRef(0);

  const handleValuesChange = (changed: Partial<{ mobile: string }>) => {
    if (!Object.hasOwn(changed, "mobile")) return;

    intent.current += 1;
    cancel();
    unlock();
    setRequestingOtp(false);
    form.setFieldValue("otp", "");
    setRemainingSeconds(0);
  };

  const handleOtpRequest = async () => {
    if (remainingSeconds > 0 || !lock()) return;
    const current = intent.current;
    const signal = start();
    setRequestingOtp(true);
    try {
      let mobile: string;
      try {
        ({ mobile } = await form.validateFields(["mobile"]));
      } catch {
        return;
      }
      if (signal.aborted || current !== intent.current) return;
      const result = await requestOtp({ mobile, purpose }, signal);
      if (
        signal.aborted ||
        current !== intent.current ||
        form.getFieldValue("mobile") !== mobile
      )
        return;
      setRemainingSeconds(Math.ceil(result.remainingSeconds));
      onSuccess();
    } catch (error) {
      if (!signal.aborted && current === intent.current && !isCancel(error))
        onError(error);
    } finally {
      if (!signal.aborted && current === intent.current) {
        setRequestingOtp(false);
        unlock();
      }
    }
  };

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setRemainingSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [remainingSeconds]);

  return {
    handleOtpRequest,
    handleValuesChange,
    remainingSeconds,
    requestingOtp,
  };
};
