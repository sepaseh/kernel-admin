// @vitest-environment jsdom
import "@/test/browser";

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

const ShellProbe = () => {
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { hash, pathname, search } = useLocation();
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
      <input aria-label="Story draft" defaultValue="" />
      <button
        onClick={() => void navigate("/users?page=2#update")}
        type="button"
      >
        Navigate users
      </button>
    </>
  );
};

const AppearanceProbe = () => {
  const { t } = useTranslation();
  const { compact, settings, theme } = useCore();
  const { direction } = useContext(ConfigProvider.ConfigContext);
  const { token } = antdTheme.useToken();

  return (
    <>
      <output aria-label="Core appearance">
        {settings.language.code}:{settings.language.direction}:
        {settings.language.calendar}:{theme}:{String(compact)}
      </output>
      <output aria-label="Ant Design direction">{direction}</output>
      <output aria-label="Ant Design background">{token.colorBgBase}</output>
      <output aria-label="Ant Design control height">
        {token.controlHeight}
      </output>
      <button type="button">{t("submit")}</button>
    </>
  );
};

const renderFrame = (
  languageCode: ComponentProps<typeof PreviewFrame>["languageCode"],
  themeMode: ComponentProps<typeof PreviewFrame>["themeMode"],
  compact = false,
  direction?: ComponentProps<typeof PreviewFrame>["direction"],
) => (
  <PreviewFrame
    compact={compact}
    direction={direction}
    languageCode={languageCode}
    themeMode={themeMode}
  >
    <StoryShell>
      <ShellProbe />
      <AppearanceProbe />
    </StoryShell>
  </PreviewFrame>
);

beforeEach(async () => {
  await i18n.changeLanguage("en");
  dayjs.calendar("gregory");
  dayjs.locale(dayjsLocaleName("en"));
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
  dayjs.calendar("gregory");
  dayjs.locale(dayjsLocaleName("en"));
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
});

describe("StoryShell and preview integration", () => {
  it("provides the default story route and synthetic account through Outlet", () => {
    render(
      <StoryShell>
        <ShellProbe />
      </StoryShell>,
    );

    expect(screen.getByLabelText("Story location").textContent).toBe("/faqs");
    expect(screen.getByLabelText("Story account").textContent).toBe(
      `${sampleUser.id}:true:`,
    );
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

    rerender(renderFrame("en", "light"));
    expect(
      Number(screen.getByLabelText("Ant Design control height").textContent),
    ).toBe(standardHeight);
    expect(screen.getByLabelText("Core appearance").textContent).toBe(
      "en:ltr:gregory:light:false",
    );
  });
});
