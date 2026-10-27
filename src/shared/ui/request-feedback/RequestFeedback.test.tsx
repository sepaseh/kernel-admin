// @vitest-environment jsdom
import { ConfigProvider } from "antd";
import { afterEach, expect, it, vi } from "vitest";

import { useReadResource } from "../../hooks/useReadResource.ts";
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

it("retries a read resource and removes feedback after recovery", async () => {
  let attempts = 0;
  const load = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("Offline");
    return "Recovered";
  };
  const ResourceFeedback = () => {
    const { data, error, loading, reload } = useReadResource(load);
    return (
      <>
        <RequestFeedback error={error} loading={loading} retry={reload} />
        {data ? <p>{data}</p> : null}
      </>
    );
  };
  const { user } = render(<ResourceFeedback />);

  expect(await screen.findByText("Offline")).toBeVisible();
  await user.click(screen.getByRole("button"));
  expect(await screen.findByText("Recovered")).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(attempts).toBe(2);
});

it("keeps failure feedback usable after a rejected retry promise", async () => {
  let attempts = 0;
  const retry = () => {
    attempts += 1;
    return attempts === 1
      ? Promise.reject(new Error("Retry request failed"))
      : Promise.resolve();
  };
  const { user } = render(
    <RequestFeedback error={new Error("Offline")} retry={retry} />,
  );

  await user.click(screen.getByRole("button"));
  expect(attempts).toBe(1);
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByText("Offline")).toBeVisible();
  await user.click(screen.getByRole("button"));
  expect(attempts).toBe(2);
  expect(screen.getByText("Offline")).toBeVisible();
});

it("keeps failure feedback usable when a retry callback throws synchronously", async () => {
  const retry = vi
    .fn()
    .mockImplementationOnce(() => {
      throw new Error("Retry callback failed");
    })
    .mockReturnValueOnce(undefined);
  const { user } = render(
    <RequestFeedback error={new Error("Offline")} retry={retry} />,
  );

  await user.click(screen.getByRole("button"));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByText("Offline")).toBeVisible();
  await user.click(screen.getByRole("button"));
  expect(retry).toHaveBeenCalledTimes(2);
});
