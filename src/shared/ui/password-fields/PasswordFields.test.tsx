// @vitest-environment jsdom
import { Button, Form } from "antd";
import { expect, it, vi } from "vitest";

import { render, screen } from "@/test/render";

import { PasswordFields } from "./PasswordFields";

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
