// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Account as CurrentUser } from "@/features/account";
import { i18n } from "@/shared/i18n";
import { ImageUpload } from "@/shared/ui/image-upload";
import { deferred } from "@/test/deferred";

import { fetchLanguages, updateSettings } from "./api";
import { SettingsPage } from "./Settings";
import type { Settings } from "./types";

const { messages, setSettings } = vi.hoisted(() => ({
  messages: { error: vi.fn(), success: vi.fn() },
  setSettings: vi.fn(),
}));
vi.mock("./api", () => ({ fetchLanguages: vi.fn(), updateSettings: vi.fn() }));
vi.mock("@/shared/ui/image-upload", () => ({ ImageUpload: vi.fn(() => null) }));
vi.mock("@/app/hooks", () => ({
  useAntd: () => ({ messageAPI: messages, token: { colorText: "#111" } }),
  useCore: () => ({ settings, setSettings }),
}));

const palette = {
  colorBgBase: "#ffffff",
  colorBgContainer: "#ffffff",
  colorBorder: "#cccccc",
  colorLink: "#0055aa",
  colorPrimary: "#0055aa",
  colorTextBase: "#111111",
  colorTextDescription: "#333333",
};
const settings: Settings = {
  darkLogo: {
    id: "synthetic-dark",
    url: "/synthetic-dark.svg",
    size: 128,
    isUsed: true,
  },
  lightLogo: {
    id: "synthetic-light",
    url: "/synthetic-light.svg",
    size: 128,
    isUsed: true,
  },
  darkTheme: palette,
  lightTheme: palette,
  imageSettings: {
    contents: { width: 400, height: 200, size: 4096 },
    logo: { width: 100, height: 100, size: 1024 },
  },
  language: {
    code: "en",
    calendar: "gregory",
    direction: "ltr",
    name: "English",
    nativeName: "English",
  },
};
const currentUser: CurrentUser = {
  id: "synthetic-settings-user",
  firstName: "Ada",
  lastName: "Lovelace",
  mobile: "09120000000",
  isSystemAdmin: true,
  status: "active",
  permissions: [],
};
const renderPage = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ currentUser }} />}>
          <Route path="*" element={<SettingsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const getLogoUpload = (id: string) => {
  const call = vi
    .mocked(ImageUpload)
    .mock.calls.findLast(([props]) => props.value?.id === id);
  if (!call) throw new Error("Logo upload control is missing");

  return call[0];
};

beforeEach(async () => {
  vi.resetAllMocks();
  currentUser.isSystemAdmin = true;
  currentUser.permissions = [];
  vi.mocked(fetchLanguages).mockResolvedValue([settings.language]);
  vi.mocked(updateSettings).mockResolvedValue(settings);
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("settings form", () => {
  it("submits logo identifiers and accepts the settings returned by the API", async () => {
    renderPage();
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() =>
      expect(setSettings).toHaveBeenCalledExactlyOnceWith(settings),
    );
    expect(updateSettings).toHaveBeenCalledExactlyOnceWith(
      {
        darkTheme: palette,
        lightTheme: palette,
        imageSettings: settings.imageSettings,
        languageCode: "en",
        darkLogoId: "synthetic-dark",
        lightLogoId: "synthetic-light",
      },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledWith(i18n.t("settingsUpdated"));
  });

  it("saves ordinary editors' settings without sending a language change", async () => {
    currentUser.isSystemAdmin = false;
    currentUser.permissions = ["settings.update"];
    renderPage();
    await act(async () => undefined);
    fireEvent.change(
      screen.getAllByRole("spinbutton", { name: i18n.t("imageWidth") })[0],
      { target: { value: "512" } },
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));

    await waitFor(() =>
      expect(setSettings).toHaveBeenCalledExactlyOnceWith(settings),
    );
    expect(updateSettings).toHaveBeenCalledExactlyOnceWith(
      {
        darkTheme: palette,
        lightTheme: palette,
        imageSettings: {
          ...settings.imageSettings,
          contents: { ...settings.imageSettings.contents, width: 512 },
        },
        darkLogoId: "synthetic-dark",
        lightLogoId: "synthetic-light",
      },
      expect.any(AbortSignal),
    );
    expect(messages.success).toHaveBeenCalledWith(i18n.t("settingsUpdated"));
  });

  it("resets edited image limits to the accepted settings", async () => {
    renderPage();
    await act(async () => undefined);
    const width = screen.getAllByRole("spinbutton", {
      name: i18n.t("imageWidth"),
    })[0] as HTMLInputElement;
    expect(width.value).toBe("400");
    fireEvent.change(width, { target: { value: "512" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("reset") }));

    expect(width.value).toBe("400");
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("blocks saving until both logo uploads finish and then sends their accepted IDs", async () => {
    const { container } = renderPage();
    await act(async () => undefined);
    const light = getLogoUpload("synthetic-light");
    const dark = getLogoUpload("synthetic-dark");
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: i18n.t("submit"),
    });
    const reset = screen.getByRole<HTMLButtonElement>("button", {
      name: i18n.t("reset"),
    });

    act(() => light.onLoadingChange?.(true));
    expect(submit.disabled).toBe(true);
    expect(reset.disabled).toBe(true);
    act(() => dark.onLoadingChange?.(true));
    fireEvent.submit(container.querySelector("form")!);
    await act(async () => undefined);
    expect(updateSettings).not.toHaveBeenCalled();

    act(() => {
      light.onChange?.({ id: "uploaded-light", url: "/uploaded-light.png" });
      light.onLoadingChange?.(false);
    });
    expect(submit.disabled).toBe(true);
    expect(reset.disabled).toBe(true);
    fireEvent.submit(container.querySelector("form")!);
    await act(async () => undefined);
    expect(updateSettings).not.toHaveBeenCalled();

    act(() => {
      dark.onChange?.({ id: "uploaded-dark", url: "/uploaded-dark.png" });
      dark.onLoadingChange?.(false);
    });
    expect(submit.disabled).toBe(false);
    expect(reset.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(updateSettings).toHaveBeenCalledWith(
      {
        darkTheme: palette,
        lightTheme: palette,
        imageSettings: settings.imageSettings,
        languageCode: "en",
        darkLogoId: "uploaded-dark",
        lightLogoId: "uploaded-light",
      },
      expect.any(AbortSignal),
    );
  });

  it("allows saving the previous logo when an upload ends without replacement", async () => {
    renderPage();
    await act(async () => undefined);
    const light = getLogoUpload("synthetic-light");
    const submit = screen.getByRole<HTMLButtonElement>("button", {
      name: i18n.t("submit"),
    });

    act(() => light.onLoadingChange?.(true));
    expect(submit.disabled).toBe(true);
    act(() => light.onLoadingChange?.(false));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateSettings).mock.calls[0][0]).toMatchObject({
      darkLogoId: "synthetic-dark",
      lightLogoId: "synthetic-light",
    });
  });

  it("blocks a pending form submission when a logo starts loading before validation finishes", async () => {
    const { container } = renderPage();
    await act(async () => undefined);
    const light = getLogoUpload("synthetic-light");
    const submit = screen.getByRole("button", { name: i18n.t("submit") });

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
      light.onLoadingChange?.(true);
    });

    expect(updateSettings).not.toHaveBeenCalled();
    expect(messages.success).not.toHaveBeenCalled();
    act(() => light.onLoadingChange?.(false));
    fireEvent.click(submit);
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
  });

  it("blocks writes without settings permission and keeps API language restricted to administrators", async () => {
    currentUser.isSystemAdmin = false;
    const { container } = renderPage();
    await act(async () => undefined);
    expect(
      (
        screen.getByRole("button", {
          name: i18n.t("submit"),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("combobox", {
          name: i18n.t("language"),
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    fireEvent.submit(container.querySelector("form")!);
    await act(async () => undefined);

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("aborts language metadata loading and ignores a late failure after unmount", async () => {
    const pending = deferred<Settings["language"][]>();
    vi.mocked(fetchLanguages).mockReturnValue(pending.promise);
    const { unmount } = renderPage();
    const signal = vi.mocked(fetchLanguages).mock.calls[0][0]!;
    unmount();

    await act(async () => {
      pending.reject(new Error("Synthetic obsolete language response"));
    });

    expect(signal.aborted).toBe(true);
    expect(messages.error).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"] as const)(
    "ignores a late save %s after leaving settings",
    async (outcome) => {
      const pending = deferred<Settings>();
      vi.mocked(updateSettings).mockReturnValue(pending.promise);
      const { unmount } = renderPage();
      await act(async () => undefined);
      fireEvent.click(screen.getByRole("button", { name: i18n.t("submit") }));
      await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
      const signal = vi.mocked(updateSettings).mock.calls[0][1]!;

      unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => {
        if (outcome === "success") pending.resolve(settings);
        else pending.reject(new Error("Synthetic obsolete settings response"));
      });

      expect(setSettings).not.toHaveBeenCalled();
      expect(messages.success).not.toHaveBeenCalled();
      expect(messages.error).not.toHaveBeenCalled();
    },
  );
});
