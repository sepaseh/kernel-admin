// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import dayjs from "dayjs";
import { memo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCore } from "@/app/hooks";
import type { ApplicationSettings } from "@/features/settings/types";
import { storageKeys } from "@/shared/config";
import { render, screen } from "@/test/render";

import { CoreProvider } from "./Core";

const mocks = vi.hoisted(() => ({
  changeLanguage: vi.fn(),
  fetchApplicationSettings: vi.fn(),
  getCompact: vi.fn<() => boolean>(),
  getTheme: vi.fn<() => "dark" | "light">(),
  setCompact: vi.fn(),
  setTheme: vi.fn(),
  watchers: new Map<string, () => void>(),
}));

const palette = {
  colorBgBase: "#ffffff",
  colorBgContainer: "#ffffff",
  colorBorder: "#dddddd",
  colorLink: "#112233",
  colorPrimary: "#112233",
  colorTextBase: "#111111",
  colorTextDescription: "#333333",
};
const savedSettings: ApplicationSettings = {
  darkTheme: palette,
  lightTheme: palette,
  lightLogo: { id: "saved-logo", url: "/saved.svg" },
  language: {
    code: "en",
    direction: "ltr",
    calendar: "gregorian",
    name: "English",
    nativeName: "English",
  },
};

vi.mock("@/features/settings/api", () => ({
  fetchApplicationSettings: mocks.fetchApplicationSettings,
}));

vi.mock("@/shared/i18n", () => ({
  i18nInstance: {
    changeLanguage: mocks.changeLanguage,
  },
}));

vi.mock("@/shared/storage", () => ({
  getCompact: mocks.getCompact,
  getTheme: mocks.getTheme,
  setCompact: mocks.setCompact,
  setTheme: mocks.setTheme,
  useLocalStorageWatcher: (key: string, callback: () => void) => {
    mocks.watchers.set(key, callback);
  },
}));

const Consumer = () => {
  const core = useCore();

  return (
    <>
      <output aria-label="core-state">
        {`${core.currentRoute}:${core.language.code}:${core.theme}:${core.compact}:${core.user?.id ?? "anonymous"}`}
      </output>
      <output aria-label="language-metadata">
        {`${core.language.code}:${core.language.direction}:${core.language.calendar}:${core.language.name}:${core.language.nativeName}`}
      </output>
      <output aria-label="application-settings">
        {`${core.logos?.light ?? "no-logo"}:${core.themePalettes?.light.colorPrimary ?? "no-palette"}`}
      </output>
      <output aria-label="settings-status">
        {core.settingsLoading
          ? "loading"
          : core.settingsError instanceof Error
            ? core.settingsError.message
            : "ready"}
      </output>
      <button type="button" onClick={() => void core.retrySettings()}>
        retry settings
      </button>
      <button type="button" onClick={() => core.acceptSettings(savedSettings)}>
        accept settings
      </button>
      <button onClick={() => core.setCurrentRoute("users")} type="button">
        route
      </button>
      <button onClick={() => core.setCompact(true)} type="button">
        compact
      </button>
      <button onClick={() => core.setTheme("dark")} type="button">
        theme
      </button>
      <button
        onClick={() =>
          core.setUser({
            email: "ada@example.com",
            firstName: "Ada",
            id: "user-1",
            isSystemAdmin: false,
            lastName: "Lovelace",
            mobile: "09120000000",
            permissions: [],
            status: "active",
            username: "ada",
          })
        }
        type="button"
      >
        user
      </button>
    </>
  );
};

beforeEach(() => {
  localStorage.clear();
  mocks.fetchApplicationSettings
    .mockReset()
    .mockRejectedValue(new Error("Unavailable"));
  mocks.getCompact.mockReturnValue(false);
  mocks.getTheme.mockReturnValue("light");
});

afterEach(() => {
  mocks.watchers.clear();
  vi.useRealTimers();
});

describe("CoreProvider", () => {
  it("does not rerender a memoized consumer for an unrelated parent render", async () => {
    mocks.fetchApplicationSettings.mockResolvedValueOnce(savedSettings);
    const observeRender = vi.fn();
    const ObservedConsumer = memo(() => {
      const { settingsLoading, theme } = useCore();
      observeRender();
      return (
        <output aria-label="observed-theme">{`${settingsLoading}:${theme}`}</output>
      );
    });
    const { rerender, user } = render(
      <CoreProvider>
        <ObservedConsumer />
        <Consumer />
      </CoreProvider>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("observed-theme")).toHaveTextContent(
        "false:light",
      ),
    );
    observeRender.mockClear();

    rerender(
      <CoreProvider>
        <ObservedConsumer />
        <Consumer />
      </CoreProvider>,
    );
    expect(observeRender).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "theme" }));
    expect(screen.getByLabelText("observed-theme")).toHaveTextContent(
      "false:dark",
    );
    expect(observeRender).toHaveBeenCalledOnce();
  });

  it("makes an initial settings failure retryable instead of silently swallowing it", async () => {
    mocks.fetchApplicationSettings
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(savedSettings);
    const { user } = render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("settings-status")).toHaveTextContent(
        "Offline",
      ),
    );
    await user.click(screen.getByRole("button", { name: "retry settings" }));
    await waitFor(() =>
      expect(screen.getByLabelText("settings-status")).toHaveTextContent(
        "ready",
      ),
    );
    expect(screen.getByLabelText("application-settings")).toHaveTextContent(
      "/saved.svg:#112233",
    );
  });

  it("a saved settings snapshot cannot be overwritten by a slow initial response", async () => {
    let release!: (settings: ApplicationSettings) => void;
    let signal!: AbortSignal;
    mocks.fetchApplicationSettings.mockImplementationOnce(
      (pending: AbortSignal) => {
        signal = pending;
        return new Promise<ApplicationSettings>((resolve) => {
          release = resolve;
        });
      },
    );
    const { user } = render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    await user.click(screen.getByRole("button", { name: "accept settings" }));
    expect(signal.aborted).toBe(true);
    await act(async () =>
      release({
        ...savedSettings,
        language: {
          ...savedSettings.language,
          direction: "rtl",
          calendar: "jalali",
        },
        lightLogo: { id: "old", url: "/old.svg" },
      }),
    );
    expect(screen.getByLabelText("application-settings")).toHaveTextContent(
      "/saved.svg:#112233",
    );
    expect(screen.getByLabelText("language-metadata")).toHaveTextContent(
      "en:ltr:gregorian:English:English",
    );
  });

  it("does not apply settings or language after its provider is unmounted", async () => {
    let release!: (settings: ApplicationSettings) => void;
    let signal!: AbortSignal;
    mocks.fetchApplicationSettings.mockImplementationOnce(
      (pending: AbortSignal) => {
        signal = pending;
        return new Promise<ApplicationSettings>((resolve) => {
          release = resolve;
        });
      },
    );
    const { unmount } = render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    mocks.changeLanguage.mockClear();
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => release(savedSettings));
    expect(mocks.changeLanguage).not.toHaveBeenCalled();
  });

  it("applies global language, logos, and theme palettes", async () => {
    mocks.fetchApplicationSettings.mockResolvedValueOnce({
      darkLogo: { id: "dark-logo", url: "/dark.svg" },
      darkTheme: {
        colorBgBase: "#141414",
        colorBgContainer: "#1f1f1f",
        colorBorder: "#424242",
        colorLink: "#1668dc",
        colorPrimary: "#001122",
        colorTextBase: "#ffffff",
        colorTextDescription: "#bfbfbf",
      },
      language: {
        calendar: "jalali",
        code: "fa",
        direction: "rtl",
        name: "Persian",
        nativeName: "فارسی",
      },
      lightLogo: { id: "light-logo", url: "/light.svg" },
      lightTheme: {
        colorBgBase: "#ffffff",
        colorBgContainer: "#ffffff",
        colorBorder: "#d9d9d9",
        colorLink: "#1677ff",
        colorPrimary: "#112233",
        colorTextBase: "#000000",
        colorTextDescription: "#8c8c8c",
      },
    });

    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("application-settings")).toHaveTextContent(
        "/light.svg:#112233",
      ),
    );
    expect(screen.getByLabelText("core-state")).toHaveTextContent(
      "root:fa:light:false:anonymous",
    );
  });

  it("ignores legacy language storage before and after public settings load", async () => {
    localStorage.setItem("language", '"ru"');
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const writeStorage = vi.spyOn(Storage.prototype, "setItem");
    let release!: (settings: ApplicationSettings) => void;
    mocks.fetchApplicationSettings.mockImplementationOnce(
      () => new Promise<ApplicationSettings>((resolve) => (release = resolve)),
    );
    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    expect(screen.getByLabelText("core-state")).toHaveTextContent(
      "root:fa:light:false:anonymous",
    );
    expect(mocks.changeLanguage).toHaveBeenCalledWith("fa");
    await act(async () => release(savedSettings));
    expect(screen.getByLabelText("core-state")).toHaveTextContent(
      "root:en:light:false:anonymous",
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "language", newValue: '"fa"' }),
      );
    });
    expect(mocks.watchers.has("language")).toBe(false);
    expect(screen.getByLabelText("core-state")).toHaveTextContent(
      "root:en:light:false:anonymous",
    );
    expect(readStorage).not.toHaveBeenCalledWith("language");
    expect(writeStorage).not.toHaveBeenCalledWith(
      "language",
      expect.anything(),
    );
  });

  it("refreshes global API language when returning to the window", async () => {
    mocks.fetchApplicationSettings
      .mockResolvedValueOnce(savedSettings)
      .mockResolvedValueOnce({
        ...savedSettings,
        language: { ...savedSettings.language, code: "fa" },
      });
    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("core-state")).toHaveTextContent(
        "root:en:light:false:anonymous",
      ),
    );
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => {
      expect(screen.getByLabelText("core-state")).toHaveTextContent(
        "root:fa:light:false:anonymous",
      );
      expect(mocks.fetchApplicationSettings).toHaveBeenCalledTimes(2);
      expect(mocks.changeLanguage).toHaveBeenLastCalledWith("fa");
    });
  });

  it("applies refreshed direction and calendar even when the language code is unchanged", async () => {
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
    mocks.fetchApplicationSettings
      .mockResolvedValueOnce(savedSettings)
      .mockResolvedValueOnce({
        ...savedSettings,
        language: {
          ...savedSettings.language,
          calendar: "jalali",
          direction: "rtl",
          name: "Server English",
          nativeName: "Server native English",
        },
      });
    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("language-metadata")).toHaveTextContent(
        "en:ltr:gregorian:English:English",
      );
      expect(dayjs().year()).toBe(2026);
    });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => {
      expect(screen.getByLabelText("language-metadata")).toHaveTextContent(
        "en:rtl:jalali:Server English:Server native English",
      );
      expect(dayjs().year()).toBe(1405);
      expect(dayjs.locale()).toBe("en-gb");
      expect(mocks.changeLanguage).toHaveBeenLastCalledWith("en");
    });
  });

  it("persists theme and compact preferences without a public language setter", async () => {
    const { user } = render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );

    expect(screen.getByLabelText("core-state")).toHaveTextContent(
      "root:fa:light:false:anonymous",
    );
    expect(screen.getByLabelText("application-settings")).toHaveTextContent(
      "/logo.svg:no-palette",
    );

    await user.click(screen.getByRole("button", { name: "route" }));
    await user.click(screen.getByRole("button", { name: "compact" }));
    await user.click(screen.getByRole("button", { name: "theme" }));
    await user.click(screen.getByRole("button", { name: "user" }));

    expect(screen.getByLabelText("core-state")).toHaveTextContent(
      "users:fa:dark:true:user-1",
    );
    expect(mocks.setCompact).toHaveBeenCalledWith(true);
    expect(mocks.changeLanguage).toHaveBeenCalledWith("fa");
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });

  it("applies preference changes received from storage without writing back", () => {
    render(
      <CoreProvider>
        <Consumer />
      </CoreProvider>,
    );
    mocks.getCompact.mockReturnValue(true);
    mocks.getTheme.mockReturnValue("dark");

    act(() => {
      mocks.watchers.get(storageKeys.compact)?.();
      mocks.watchers.get(storageKeys.theme)?.();
    });

    expect(screen.getByLabelText("core-state")).toHaveTextContent(
      "root:fa:dark:true:anonymous",
    );
    expect(mocks.setCompact).not.toHaveBeenCalled();
    expect(mocks.setTheme).not.toHaveBeenCalled();
    expect(mocks.changeLanguage).toHaveBeenCalledWith("fa");
  });
});
