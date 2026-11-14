// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfigProvider, theme as antdTheme } from "antd";
import dayjs from "dayjs";
import { type ComponentProps, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useOutletContext } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useCore } from "@/app/hooks";
import type { CurrentUser } from "@/features/account";
import type { DefaultLayoutContext } from "@/layouts/default";
import { dayjsLocaleName, i18n } from "@/shared/i18n";

import { PreviewFrame } from "../../../.storybook/PreviewFrame";
import { StoryShell } from "../../../.storybook/StoryShell";
import { sampleSettings, sampleUser } from "../../../.storybook/fixtures";

import { sampleLanguages, sampleSettings } from "./fixtures";
import { StoryShell } from "./StoryShell";

const lightTheme = {
  colorBgBase: "#fff",
  colorBgContainer: "#fff",
  colorBorder: "#767676",
  colorLink: "#0050b3",
  colorPrimary: "#1677ff",
  colorTextBase: "#000",
  colorTextDescription: "#444",
};

const AppearanceProbe = () => {
  const {
    setSettings,
    currentRoute,
    language,
    setCurrentRoute,
    setTheme,
    theme,
  } = useCore();
  const { direction, theme: themeConfig } = useContext(
    ConfigProvider.ConfigContext,
  );
  const { token } = antdTheme.useToken();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <output aria-label="Story location">
        {pathname}
        {search}
        {hash}
      </output>
      <output aria-label="Story account">
        {currentUser.id}:{String(currentUser.isSystemAdmin)}:
        {currentUser.permissions.join(",")}
      </output>
      <output data-testid="button-appearance">
        {token.colorPrimary}:
        {themeConfig?.components?.Button?.primaryColor ?? "default"}
      </output>
      <output data-testid="route">
        {currentRoute}:{location.pathname}
      </output>
      <button onClick={() => setTheme("dark")}>Change menu theme</button>
      <button
        onClick={() =>
          setSettings({
            ...sampleSettings,
            darkTheme: {
              ...lightTheme,
              colorBgBase: "#000",
              colorBgContainer: "#141414",
              colorTextBase: "#fff",
              colorTextDescription: "#ddd",
            },
            language: sampleLanguages.fa,
            lightTheme,
          })
        }
      >
        Accept settings
      </button>
      <button
        onClick={() => {
          setCurrentRoute("users");
          void navigate("/users");
        }}
      >
        Navigate users
      </button>
    </>
  );
};

afterEach(async () => {
  cleanup();
  await i18nInstance.changeLanguage("fa");
});

describe("StoryShell appearance ownership", () => {
  it("keeps application button colors independent of the preview surface", () => {
    render(
      <PreviewFrame direction="ltr" languageCode="en" themeMode="light">
        <StoryShell>
          <AppearanceProbe />
        </StoryShell>
      </PreviewFrame>,
    );

    expect(screen.getByTestId("button-appearance")).toHaveTextContent(
      `${sampleSettings.lightTheme.colorPrimary}:default`,
    );
  });

  it("uses standalone initial metadata and working route state", async () => {
    render(
      <StoryShell>
        <ShellProbe />
      </StoryShell>,
    );

    expect(screen.getByLabelText("Story location").textContent).toBe("/faqs");
    expect(screen.getByLabelText("Story account").textContent).toBe(
      `${sampleUser.id}:true:`,
    );
    expect(screen.getByTestId("antd-appearance")).toHaveTextContent(
      `rtl:${sampleSettings.darkTheme.colorBgBase}`,
    );
    await screen.findByRole("button", { name: "ثبت" });
    fireEvent.click(screen.getByRole("button", { name: "Navigate users" }));
    expect(screen.getByTestId("route")).toHaveTextContent("users:/users");
  });

  it("keeps a supplied account while navigating from the configured URL", () => {
    const reader: CurrentUser = {
      ...sampleUser,
      id: "synthetic-reader",
      isSystemAdmin: false,
      permissions: ["users.read"],
    };
    render(
      <StoryShell initialEntries={["/roles?page=3#update"]} user={reader}>
        <ShellProbe />
      </StoryShell>,
    );

    expect(screen.getByLabelText("Story location").textContent).toBe(
      "/roles?page=3#update",
    );
    expect(screen.getByLabelText("Story account").textContent).toBe(
      "synthetic-reader:false:users.read",
    );
    fireEvent.click(screen.getByRole("button", { name: "Navigate users" }));
    expect(screen.getByLabelText("Story location").textContent).toBe(
      "/users?page=2#update",
    );
    expect(screen.getByLabelText("Story account").textContent).toBe(
      "synthetic-reader:false:users.read",
    );
  });

  it("applies toolbar appearance changes without resetting navigation or the story draft", async () => {
    const { rerender } = render(renderFrame("en", "light"));
    await screen.findByRole("button", { name: i18n.getFixedT("en")("submit") });
    expect(screen.getByLabelText("Core appearance").textContent).toBe(
      "en:ltr:gregory:light:false",
    );
    expect(screen.getByLabelText("Ant Design background").textContent).toBe(
      sampleSettings.lightTheme.colorBgBase,
    );
    fireEvent.change(screen.getByLabelText("Story draft"), {
      target: { value: "Keep this unfinished story form" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Navigate users" }));

    rerender(renderFrame("en", "light", false, "rtl"));
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(screen.getByLabelText("Core appearance").textContent).toBe(
      "en:rtl:gregory:light:false",
    );
    expect(screen.getByLabelText("Ant Design direction").textContent).toBe(
      "rtl",
    );
    expect(document.documentElement.lang).toBe("en");
    expect(dayjs.locale()).toBe(dayjsLocaleName("en"));
    expect(screen.getByLabelText("Story location").textContent).toBe(
      "/users?page=2#update",
    );
    expect(screen.getByRole("textbox", { name: "Story draft" })).toHaveProperty(
      "value",
      "Keep this unfinished story form",
    );

    rerender(renderFrame("fa", "dark"));
    await screen.findByRole("button", { name: i18n.getFixedT("fa")("submit") });
    expect(screen.getByLabelText("Core appearance").textContent).toBe(
      "fa:rtl:jalali:dark:false",
    );
    expect(screen.getByLabelText("Ant Design direction").textContent).toBe(
      "rtl",
    );
    expect(screen.getByLabelText("Ant Design background").textContent).toBe(
      sampleSettings.darkTheme.colorBgBase,
    );
    expect(document.documentElement.lang).toBe("fa");
    expect(document.documentElement.dir).toBe("rtl");
    expect(dayjs.locale()).toBe(dayjsLocaleName("fa"));
    expect(dayjs("2026-04-01T12:00:00Z").format("YYYY")).toBe("1405");
    expect(screen.getByLabelText("Story location").textContent).toBe(
      "/users?page=2#update",
    );
    expect(screen.getByRole("textbox", { name: "Story draft" })).toHaveProperty(
      "value",
      "Keep this unfinished story form",
    );

    rerender(renderFrame("fa", "dark"));
    expect(screen.getByLabelText("Core appearance").textContent).toBe(
      "fa:rtl:jalali:dark:false",
    );
    expect(screen.getByLabelText("Story location").textContent).toBe(
      "/users?page=2#update",
    );

    rerender(renderFrame("en", "light"));
    await screen.findByRole("button", { name: i18n.getFixedT("en")("submit") });
    expect(screen.getByLabelText("Core appearance").textContent).toBe(
      "en:ltr:gregory:light:false",
    );
    expect(screen.getByLabelText("Ant Design direction").textContent).toBe(
      "ltr",
    );
    expect(screen.getByLabelText("Ant Design background").textContent).toBe(
      sampleSettings.lightTheme.colorBgBase,
    );
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(dayjs.locale()).toBe(dayjsLocaleName("en"));
    expect(dayjs("2026-04-01T12:00:00Z").format("YYYY")).toBe("2026");
    expect(screen.getByLabelText("Story location").textContent).toBe(
      "/users?page=2#update",
    );
    expect(screen.getByRole("textbox", { name: "Story draft" })).toHaveProperty(
      "value",
      "Keep this unfinished story form",
    );
    expect(screen.getByTestId("antd-appearance")).toHaveTextContent(
      `rtl:${sampleSettings.darkTheme.colorBgBase}`,
    );
    expect(screen.getByTestId("route")).toHaveTextContent("users:/users");
    await screen.findByRole("button", { name: "ثبت" });
    expect(document.documentElement).toHaveAttribute("lang", "fa");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });

  it("applies compact sizing without changing the active language or theme", async () => {
    const { rerender } = render(renderFrame("en", "light"));
    const standardHeight = Number(
      screen.getByLabelText("Ant Design control height").textContent,
    );
    expect(standardHeight).toBeGreaterThan(0);

    rerender(renderFrame("en", "light", true));
    await waitFor(() =>
      expect(
        Number(screen.getByLabelText("Ant Design control height").textContent),
      ).toBeLessThan(standardHeight),
    );
    expect(screen.getByLabelText("Core appearance").textContent).toBe(
      "en:ltr:gregory:light:true",
    );

    expect(screen.getByTestId("core-appearance")).toHaveTextContent(
      "en:rtl:gregory:light",
    );
    expect(screen.getByTestId("antd-appearance")).toHaveTextContent(
      `rtl:${sampleSettings.lightTheme.colorBgBase}`,
    );
    await screen.findByRole("button", { name: "Submit" });
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});
