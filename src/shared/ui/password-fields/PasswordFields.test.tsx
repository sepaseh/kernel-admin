import "@/test/browser";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Button, Form } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import { PasswordFields } from "./PasswordFields";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

it("rejects mismatched confirmation and submits matching values with accessible labels", async () => {
  const onFinish = vi.fn();
  render(
    <Form name="password-validation" onFinish={onFinish}>
      <PasswordFields size="large" />
      <Button htmlType="submit">Save</Button>
    </Form>,
  );
  const password = screen.getByLabelText<HTMLInputElement>(i18n.t("password"));
  const confirmation = screen.getByLabelText<HTMLInputElement>(
    i18n.t("confirmPassword"),
  );
  expect(password.id).not.toBe(confirmation.id);
  fireEvent.change(password, { target: { value: "secret-1" } });
  fireEvent.change(confirmation, { target: { value: "different" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText(i18n.t("passwordMismatch"));
  expect(onFinish).not.toHaveBeenCalled();

  fireEvent.change(confirmation, { target: { value: "secret-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(onFinish).toHaveBeenCalledWith({
      password: "secret-1",
      confirmPassword: "secret-1",
    }),
  );
});
