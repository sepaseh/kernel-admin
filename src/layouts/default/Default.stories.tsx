import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import type { RouteKey } from "@/app/config";
import { useCore } from "@/app/hooks";
import { apiClient } from "@/shared/api";
import { i18nInstance } from "@/shared/i18n";

import { DefaultLayout } from "./Default";

type LayoutContentProps = { route: RouteKey; title: string };

const LayoutContent = ({ route, title }: LayoutContentProps) => {
  const { setCurrentRoute } = useCore();
  useEffect(() => setCurrentRoute(route), [route, setCurrentRoute]);
  return <h2>{title}</h2>;
};

const DefaultLayoutStory = () => {
  const [router] = useState(() =>
    createMemoryRouter([
      {
        children: [
          {
            element: <LayoutContent route="root" title="Dashboard content" />,
            index: true,
          },
          {
            element: <LayoutContent route="users" title="Users destination" />,
            path: "users",
          },
        ],
        element: <DefaultLayout />,
        path: "/",
      },
      { element: <h1>Signed out destination</h1>, path: "/auth" },
    ]),
  );

  useEffect(() => () => router.dispose(), [router]);

  return <RouterProvider router={router} />;
};

const meta = {
  component: DefaultLayout,
  parameters: { ownsMain: true },
  render: () => <DefaultLayoutStory />,
  title: "Layouts/Default",
} satisfies Meta<typeof DefaultLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { name: "Dashboard content" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("account") }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByText(i18nInstance.t("darkMode"))).toBeVisible(),
    );
    await userEvent.keyboard("{Escape}");
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Dashboard content" });
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("menu") }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const drawer = await body.findByRole("dialog");
    await userEvent.click(
      within(drawer).getByText(i18nInstance.t("userManagement")),
    );
    const destination = within(drawer).getByRole("link", {
      name: i18nInstance.t("users"),
    });
    destination.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      await canvas.findByRole("heading", { name: "Users destination" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(mocked(apiClient.get)).toHaveBeenCalledOnce();
  },
};

export const LoadingAccount: Story = {
  parameters: { fixtureState: "account-loading" },
  play: async ({ canvasElement }) => {
    await expect(mocked(apiClient.get)).toHaveBeenCalledOnce();
    await expect(canvasElement.querySelector(".ant-spin")).toBeVisible();
    await expect(
      within(canvasElement).queryByRole("heading", {
        name: "Dashboard content",
      }),
    ).not.toBeInTheDocument();
  },
};

export const DarkRtl: Story = {
  globals: { direction: "rtl", language: "fa", theme: "dark" },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("heading", {
        name: "Dashboard content",
      }),
    ).toBeVisible();
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute(
      "dir",
      "rtl",
    );
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute(
      "lang",
      "fa",
    );
  },
};

export const AccountFailure: Story = {
  parameters: { fixtureState: "account-error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("Synthetic account unavailable"),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", {
        name: i18nInstance.t("retry"),
      }),
    ).toBeEnabled();
    await expect(
      within(canvasElement.ownerDocument.body).queryByLabelText(
        i18nInstance.t("loading"),
      ),
    ).not.toBeInTheDocument();
  },
};

export const Logout: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Dashboard content" });
    await userEvent.click(
      canvas.getByRole("button", { name: i18nInstance.t("account") }),
    );
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByText(
        i18nInstance.t("logout"),
      ),
    );
    await expect(
      await canvas.findByText("Signed out destination"),
    ).toBeVisible();
    await expect(apiClient.post).toHaveBeenCalledWith("/auth/logout");
  },
};
