// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import dayjs from "dayjs";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCore } from "@/app/hooks";
import type { Settings } from "@/features/settings";
import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { CoreProvider } from "./Core";

const { fetchSettings } = vi.hoisted(() => ({ fetchSettings: vi.fn() }));
vi.mock("@/features/settings", () => ({ fetchSettings }));

const colors = {
  colorBgBase: "#ffffff",
  colorBgContainer: "#ffffff",
  colorBorder: "#cccccc",
  colorLink: "#0055aa",
  colorPrimary: "#0055aa",
  colorTextBase: "#111111",
  colorTextDescription: "#333333",
};
const settings: Settings = {
  darkTheme: colors,
  lightTheme: colors,
  imageSettings: {
    // These values are synthetic API metadata, independent of local uploads.
    logo: { height: 100, width: 100, size: 1024 },
    contents: { height: 100, width: 100, size: 1024 },
  },
  language: {
    code: "fa",
    direction: "rtl",
    calendar: "jalali",
    name: "Persian",
    nativeName: "فارسی",
  },
};

const Consumer = () => {
  const core = useCore();

  return (
    <>
      <output>{`${core.settings.language.code}/${core.settings.language.direction}/${core.theme}/${core.compact}`}</output>
      <button
        onClick={() => {
          core.setTheme("light");
          core.setCompact(true);
        }}
      >
        Change appearance
      </button>
      <button
        onClick={() =>
          core.setSettings({
            ...settings,
            language: {
              code: "en",
              direction: "ltr",
              calendar: "gregory",
              name: "English",
              nativeName: "English",
            },
          })
        }
      >
        Accept settings
      </button>
    </>
  );
};

beforeEach(async () => {
  localStorage.clear();
  fetchSettings.mockReset();
  await i18n.changeLanguage("en");
  dayjs.calendar("gregory");
  dayjs.locale("en");
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("core settings ownership", () => {
  it("waits for API settings and applies their language and Persian calendar", async () => {
    const pending = deferred<Settings>();
    fetchSettings.mockReturnValue(pending.promise);
    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );

    expect(screen.queryByText("fa/rtl/dark/false")).toBeNull();
    await act(async () => {
      pending.resolve(settings);
    });

    expect(screen.getByText("fa/rtl/dark/false")).toBeDefined();
    expect(i18n.language).toBe("fa");
    expect(dayjs("2026-03-21").format("YYYY-MM-DD")).toBe("1405-01-01");
    expect(dayjs.locale()).toBe("fa");
  });

  it("reports an initial settings failure and finishes loading", async () => {
    fetchSettings.mockRejectedValueOnce(
      new Error("Synthetic offline response"),
    );
    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );

    expect(await screen.findByText(i18n.t("settingsLoadFailed"))).toBeDefined();
    expect(screen.queryByLabelText(i18n.t("loading"))).toBeNull();
  });

  it("persists appearance preferences while language remains owned by accepted API settings", async () => {
    fetchSettings.mockResolvedValue(settings);
    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    await screen.findByText("fa/rtl/dark/false");

    fireEvent.click(screen.getByRole("button", { name: "Change appearance" }));
    expect(screen.getByText("fa/rtl/light/true")).toBeDefined();
    expect(localStorage.getItem("theme")).toBe('"light"');
    expect(localStorage.getItem("compact")).toBe("true");
    expect(localStorage).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Accept settings" }));
    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(screen.getByText("en/ltr/light/true")).toBeDefined();
    expect(dayjs("2026-03-21").format("YYYY-MM-DD")).toBe("2026-03-21");
  });

  it("ignores a canceled Strict Mode fetch that completes after its replacement", async () => {
    const first = deferred<Settings>();
    fetchSettings
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(settings);
    render(
      <StrictMode>
        <CoreProvider>
          <Consumer />
        </CoreProvider>
      </StrictMode>,
    );
    await screen.findByText("fa/rtl/dark/false");
    expect(fetchSettings.mock.calls[0][0].aborted).toBe(true);

    await act(async () => {
      first.resolve({
        ...settings,
        language: { ...settings.language, code: "en" },
      });
    });

    expect(screen.getByText("fa/rtl/dark/false")).toBeDefined();
    expect(i18n.language).toBe("fa");
  });

  it("aborts its owned request on unmount", () => {
    fetchSettings.mockReturnValue(deferred<Settings>().promise);
    const { unmount } = render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    const signal: AbortSignal = fetchSettings.mock.calls[0][0];

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("retries initial settings loading without exposing children before acceptance", async () => {
    fetchSettings
      .mockRejectedValueOnce(new Error("Synthetic offline response"))
      .mockResolvedValueOnce(settings);
    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    await screen.findByText(i18n.t("settingsLoadFailed"));
    expect(screen.queryByText("fa/rtl/dark/false")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("retry") }));

    await screen.findByText("fa/rtl/dark/false");
    expect(fetchSettings).toHaveBeenCalledTimes(2);
  });
});
