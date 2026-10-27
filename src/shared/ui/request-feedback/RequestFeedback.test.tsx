// @vitest-environment jsdom
import { ConfigProvider } from "antd";
import { afterEach, expect, it, vi } from "vitest";

import { i18nInstance } from "../../i18n/index.ts";
import { render, screen } from "../../../test/render.tsx";
import { RequestFeedback } from "./RequestFeedback.tsx";

afterEach(async () => {
  await i18nInstance.changeLanguage("fa");
});

it("offers a working localized RTL retry after an initial read fails", async () => {
  await i18nInstance.changeLanguage("fa");
  const retry = vi.fn();
  const { user } = render(
    <ConfigProvider direction="rtl">
      <RequestFeedback error={new Error("Offline")} retry={retry} />
    </ConfigProvider>,
  );
  expect(screen.getByRole("alert")).toHaveClass("ant-alert-rtl");
  expect(screen.getByText(i18nInstance.t("requestLoadFailed"))).toBeVisible();
  expect(screen.getByText("Offline")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: i18nInstance.t("retry") }),
  );
  expect(retry).toHaveBeenCalledOnce();
});

it("preserves refresh feedback and suppresses retry clicks while another read is pending", async () => {
  await i18nInstance.changeLanguage("en");
  const retry = vi.fn();
  const { user, rerender } = render(
    <RequestFeedback
      error={new Error("Offline")}
      hasData
      loading
      retry={retry}
    />,
  );
  expect(
    screen.getByText(i18nInstance.t("requestRefreshFailed")),
  ).toBeVisible();
  await user.click(screen.getByRole("button"));
  expect(retry).not.toHaveBeenCalled();
  rerender(<RequestFeedback retry={retry} />);
  expect(screen.queryByRole("alert")).toBeNull();
});
