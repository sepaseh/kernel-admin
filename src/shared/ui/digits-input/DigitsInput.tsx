import type { InputProps } from "antd";
import { Input } from "antd";
import { useState } from "react";

type DigitsInputProps = InputProps;

const digitsOnly = (value: InputProps["value"]) =>
  String(value ?? "").replace(/\D/g, "");

export const DigitsInput = ({
  defaultValue,
  onChange,
  value,
  ...rest
}: DigitsInputProps) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    digitsOnly(defaultValue),
  );

  return (
    <Input
      {...rest}
      onChange={(event) => {
        const next = digitsOnly(event.target.value);
        if (value === undefined) setUncontrolledValue(next);
        event.target.value = next;
        event.currentTarget.value = next;
        onChange?.(event);
      }}
      value={value === undefined ? uncontrolledValue : digitsOnly(value)}
    />
  );
};
