import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import { Route, Routes } from "react-router";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import type { RouteKey } from "@/app/config";
import { useCore } from "@/app/hooks";
import { getAccount } from "@/features/account/api.ts";
import type { Account } from "@/features/account/types.ts";
import { logout } from "@/features/auth/api.ts";
import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";
import { sampleLanguages } from "@/test/storybook/fixtures";

import { DefaultLayout } from "./Default";

const account: Account = {
  email: "admin@example.com",
  firstName: "Sample",
  id: "storybook-user",
  isSystemAdmin: true,
  lastName: "Admin",
  mobile: "09120000000",
  permissions: [],
  status: "active",
  username: "admin",
};

type DefaultLayoutStoryProps = Pick<
  ComponentProps<typeof StoryShell>,
  "initialLanguage" | "initialTheme" | "initialUser" | "withUser"
>;
type LayoutContentProps = { route: RouteKey; title: string };

const LayoutContent = ({ route, title }: LayoutContentProps) => {
  const { setCurrentRoute } = useCore();
  useEffect(() => setCurrentRoute(route), [route, setCurrentRoute]);
  return <h2>{title}</h2>;
};

const DefaultLayoutStory = (props: DefaultLayoutStoryProps) => (
  <StoryShell initialUser={account} {...props}>
    <Routes>
      <Route element={<DefaultLayout />} path="/">
        <Route
          index
          element={<LayoutContent route="root" title="Dashboard content" />}
        />
        <Route
          element={<LayoutContent route="users" title="Users destination" />}
          path="users"
        />
      </Route>
      <Route element={<h1>Signed out destination</h1>} path="/auth" />
    </Routes>
  </StoryShell>
);

const meta = {
  beforeEach() {
    mocked(getAccount).mockReset().mockResolvedValue(account);
    mocked(logout).mockReset().mockResolvedValue(undefined);
  },
  component: DefaultLayout,
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
    await expect(mocked(getAccount)).toHaveBeenCalledOnce();
  },
};

export const LoadingAccount: Story = {
  beforeEach() {
    mocked(getAccount).mockReturnValue(new Promise(() => undefined));
  },
  render: () => <DefaultLayoutStory withUser={false} />,
  play: async ({ canvasElement }) => {
    await expect(mocked(getAccount)).toHaveBeenCalledOnce();
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
  render: () => (
    <DefaultLayoutStory
      initialLanguage={sampleLanguages.fa}
      initialTheme="dark"
    />
  ),
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
