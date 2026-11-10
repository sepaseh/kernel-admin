import "@/test/browser";

import { cleanup, render, screen } from "@testing-library/react";
import { ConfigProvider } from "antd";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAntd } from "@/app/hooks/useAntd";
import type { Settings } from "@/features/settings";
import type { Theme } from "@/shared/contracts";

import { AntdProvider } from "./Antd";

const state = vi.hoisted(() => ({
  compact: false,
  theme: "light" as Theme,
  settings: {} as Settings,
}));
vi.mock("@/app/hooks", () => ({ useCore: () => state }));

const colors = {
  colorBgBase: "#ffffff",
  colorBgContainer: "#ffffff",
  colorBorder: "#cccccc",
  colorLink: "#0055aa",
  colorPrimary: "#0055aa",
  colorTextBase: "#111111",
  colorTextDescription: "#333333",
};

const Consumer = () => {
  const { messageAPI, modalAPI, notificationAPI, token } = useAntd();
  const config = useContext(ConfigProvider.ConfigContext);
  return (
    <>
      <output aria-label="APIs">
        {messageAPI && modalAPI && notificationAPI ? "ready" : "missing"}
      </output>
      <output aria-label="locale">{`${config.locale?.locale}:${config.direction}`}</output>
      <output aria-label="primary">{token.colorPrimary}</output>
      <output aria-label="height">{token.controlHeight}</output>
      <output aria-label="background">{token.colorBgBase}</output>
    </>
  );
};

beforeEach(() => {
  state.compact = false;
  state.theme = "light";
  state.settings = {
    lightTheme: colors,
    darkTheme: { ...colors, colorBgBase: "#101010", colorTextBase: "#f0f0f0" },
    imageSettings: {
      logo: { width: 100, height: 100, size: 1024 },
      contents: { width: 100, height: 100, size: 1024 },
    },
    language: {
      code: "en",
      direction: "ltr",
      calendar: "gregory",
      name: "English",
      nativeName: "English",
    },
  };
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
});

describe("Ant Design settings integration", () => {
  it("provides UI APIs and follows API direction independently of vendor locale", () => {
    const { rerender } = render(
      <AntdProvider>
        <Consumer />
      </AntdProvider>,
    );
    expect(screen.getByLabelText("APIs").textContent).toBe("ready");
    expect(screen.getByLabelText("locale").textContent).toBe("en-gb:ltr");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");

    state.settings = {
      ...state.settings,
      language: { ...state.settings.language, direction: "rtl" },
    };
    rerender(
      <AntdProvider>
        <Consumer />
      </AntdProvider>,
    );
    expect(screen.getByLabelText("locale").textContent).toBe("en-gb:rtl");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("rtl");

    state.settings = {
      ...state.settings,
      language: { ...state.settings.language, code: "fa", direction: "ltr" },
    };
    rerender(
      <AntdProvider>
        <Consumer />
      </AntdProvider>,
    );
    expect(screen.getByLabelText("locale").textContent).toBe("fa:ltr");
    expect(document.documentElement.lang).toBe("fa");
  });

  it("uses the accepted active palette and applies compact sizing", () => {
    const { rerender } = render(
      <AntdProvider>
        <Consumer />
      </AntdProvider>,
    );
    expect(screen.getByLabelText("primary").textContent).toBe(
      colors.colorPrimary,
    );
    const standardHeight = Number(screen.getByLabelText("height").textContent);
    state.compact = true;
    state.theme = "dark";
    rerender(
      <AntdProvider>
        <Consumer />
      </AntdProvider>,
    );
    expect(Number(screen.getByLabelText("height").textContent)).toBeLessThan(
      standardHeight,
    );
    expect(screen.getByLabelText("background").textContent).toBe("#101010");

    state.settings = {
      ...state.settings,
      darkTheme: { ...state.settings.darkTheme, colorBgBase: "#202020" },
    };
    rerender(
      <AntdProvider>
        <Consumer />
      </AntdProvider>,
    );
    expect(screen.getByLabelText("background").textContent).toBe("#202020");
  });
});
