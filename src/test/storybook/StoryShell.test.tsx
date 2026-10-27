// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfigProvider, theme as antdTheme } from "antd";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { PreviewFrame } from "../../../.storybook/PreviewFrame";
import { useCore } from "@/app/hooks";
import { i18nInstance } from "@/shared/i18n";

import { sampleLanguages } from "./fixtures";
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
    acceptSettings,
    currentRoute,
    language,
    setCurrentRoute,
    setTheme,
    theme,
  } = useCore();
  const { direction } = useContext(ConfigProvider.ConfigContext);
  const { token } = antdTheme.useToken();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <output data-testid="core-appearance">
        {language.code}:{language.direction}:{language.calendar}:{theme}
      </output>
      <output data-testid="antd-appearance">
        {direction}:{token.colorBgBase}
      </output>
      <output data-testid="route">
        {currentRoute}:{location.pathname}
      </output>
      <button onClick={() => setTheme("dark")}>Change menu theme</button>
      <button
        onClick={() =>
          acceptSettings({
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
      <button>{t("submit")}</button>
    </>
  );
};

afterEach(async () => {
  await i18nInstance.changeLanguage("fa");
});

describe("StoryShell appearance ownership", () => {
  it("uses standalone initial metadata and working route state", async () => {
    render(
      <StoryShell initialLanguage={sampleLanguages.fa} initialTheme="dark">
        <AppearanceProbe />
      </StoryShell>,
    );

    expect(screen.getByTestId("core-appearance")).toHaveTextContent(
      "fa:rtl:jalali:dark",
    );
    expect(screen.getByTestId("antd-appearance")).toHaveTextContent("rtl:#000");
    await screen.findByRole("button", { name: "ثبت" });
    fireEvent.click(screen.getByRole("button", { name: "Navigate users" }));
    expect(screen.getByTestId("route")).toHaveTextContent("users:/users");
  });

  it("applies toolbar metadata to real Core and Antd consumers without resetting navigation", async () => {
    const renderFrame = (
      languageCode: "en" | "fa",
      themeMode: "light" | "dark",
    ) => (
      <PreviewFrame
        direction={languageCode === "fa" ? "rtl" : "ltr"}
        languageCode={languageCode}
        themeMode={themeMode}
      >
        <StoryShell>
          <AppearanceProbe />
        </StoryShell>
      </PreviewFrame>
    );
    const { rerender } = render(renderFrame("en", "light"));
    await screen.findByRole("button", { name: "Submit" });
    fireEvent.click(screen.getByRole("button", { name: "Navigate users" }));

    rerender(renderFrame("fa", "dark"));

    expect(screen.getByTestId("core-appearance")).toHaveTextContent(
      "fa:rtl:jalali:dark",
    );
    expect(screen.getByTestId("antd-appearance")).toHaveTextContent("rtl:#000");
    expect(screen.getByTestId("route")).toHaveTextContent("users:/users");
    await screen.findByRole("button", { name: "ثبت" });
    expect(document.documentElement).toHaveAttribute("lang", "fa");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });

  it("keeps accepted settings and menu theme through unrelated parent and toolbar theme updates", async () => {
    const renderFrame = (themeMode: "light" | "dark") => (
      <PreviewFrame direction="ltr" languageCode="en" themeMode={themeMode}>
        <StoryShell>
          <AppearanceProbe />
        </StoryShell>
      </PreviewFrame>
    );
    const { rerender } = render(renderFrame("light"));
    fireEvent.click(screen.getByRole("button", { name: "Accept settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Change menu theme" }));
    await screen.findByRole("button", { name: "ثبت" });

    rerender(renderFrame("light"));
    rerender(renderFrame("dark"));

    await waitFor(() => {
      expect(screen.getByTestId("core-appearance")).toHaveTextContent(
        "fa:rtl:jalali:dark",
      );
      expect(screen.getByTestId("antd-appearance")).toHaveTextContent(
        "rtl:#000",
      );
      expect(document.documentElement).toHaveAttribute("lang", "fa");
      expect(document.documentElement).toHaveAttribute("dir", "rtl");
    });
    expect(screen.getByRole("button", { name: "ثبت" })).toBeVisible();
  });

  it("treats the toolbar direction as independent from the selected language", async () => {
    render(
      <PreviewFrame direction="rtl" languageCode="en" themeMode="light">
        <StoryShell>
          <AppearanceProbe />
        </StoryShell>
      </PreviewFrame>,
    );

    expect(screen.getByTestId("core-appearance")).toHaveTextContent(
      "en:rtl:gregorian:light",
    );
    expect(screen.getByTestId("antd-appearance")).toHaveTextContent("rtl:#fff");
    await screen.findByRole("button", { name: "Submit" });
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });
});
