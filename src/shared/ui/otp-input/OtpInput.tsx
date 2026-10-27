import { Input } from "antd";
import type { ComponentProps } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

const Otp = Input.OTP;

type OtpInputProps = ComponentProps<typeof Otp>;

export const OtpInput = ({
  "aria-describedby": describedBy,
  "aria-required": required,
  ...props
}: OtpInputProps) => {
  const { t } = useTranslation();
  const requiredDescriptionId = useId();
  const isRequired = required === true || required === "true";
  const description =
    [describedBy, isRequired ? requiredDescriptionId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <>
      <Otp {...props} aria-describedby={description} />
      {isRequired && (
        <span
          id={requiredDescriptionId}
          style={{
            clipPath: "inset(50%)",
            height: 1,
            overflow: "hidden",
            position: "absolute",
            whiteSpace: "nowrap",
            width: 1,
          }}
        >
          {t("requiredField")}
        </span>
      )}
    </>
  );
};
