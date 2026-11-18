// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";

import { RequestError } from "./RequestError";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

it("shows the request failure and invokes its owner's retry", () => {
  const onRetry = vi.fn();
  const { rerender } = render(
    <RequestError
      error={new Error("Synthetic service unavailable")}
      onRetry={onRetry}
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Synthetic service unavailable",
  );
  fireEvent.click(screen.getByRole("button", { name: i18n.t("retry") }));
  expect(onRetry).toHaveBeenCalledOnce();
  rerender(<RequestError error={new Error("")} onRetry={onRetry} />);
  expect(screen.getByRole("alert").textContent).toContain(
    i18n.t("unexpectedError"),
  );
});
