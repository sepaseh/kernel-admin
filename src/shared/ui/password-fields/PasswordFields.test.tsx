// @vitest-environment jsdom
import { Button, Form } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { i18nInstance } from "@/shared/i18n";
import { render, screen } from "@/test/render";

import { PasswordFields } from "./PasswordFields";

let previousLanguage: string;

beforeEach(async () => {
  previousLanguage = i18nInstance.language;
  await i18nInstance.changeLanguage("fa");
});

afterEach(async () => {
  await i18nInstance.changeLanguage(previousLanguage);
});

it("accepts matching passwords and rejects mismatched confirmation", async () => {
  const onFinish = vi.fn();
  const { user } = render(
    <Form onFinish={onFinish}>
      <PasswordFields size="large" />
      <Button htmlType="submit">Submit</Button>
    </Form>,
  );
  const password = screen.getByPlaceholderText("رمز عبور");
  const confirmation = screen.getByPlaceholderText("تکرار رمز عبور");

  await user.type(password, "secret-1");
  await user.type(confirmation, "different");
  await user.click(screen.getByRole("button", { name: "Submit" }));
  expect(onFinish).not.toHaveBeenCalled();

  await user.clear(confirmation);
  await user.type(confirmation, "secret-1");
  await user.click(screen.getByRole("button", { name: "Submit" }));
  expect(onFinish).toHaveBeenCalledWith({
    confirmPassword: "secret-1",
    password: "secret-1",
  });
});
