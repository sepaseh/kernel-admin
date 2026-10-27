import { Input } from "antd";
import type { ComponentProps } from "react";

const Otp = Input.OTP;

type OtpInputProps = ComponentProps<typeof Otp>;

export const OtpInput = (props: OtpInputProps) => {
  return <Otp {...props} aria-required={undefined} />;
};
