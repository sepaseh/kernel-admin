// @vitest-environment jsdom
import { act, waitFor } from "@testing-library/react";
import type * as ReactI18next from "react-i18next";
import { beforeEach, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render";
import { clearAccessToken, setAccessToken } from "@/shared/api";

import {
  fetchApplicationSettings,
  fetchLanguages,
  updateApplicationSettings,
} from "./api";
import { SettingsPage } from "./Settings";
import type { ApplicationSettings } from "./types";

const mocks = vi.hoisted(() => ({
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  modalConfirm: vi.fn(),
  acceptSettings: vi.fn(),
  setLogos: vi.fn(),
  setThemePalettes: vi.fn(),
  canUpdate: true,
  user: { id: "settings-editor", isSystemAdmin: true },
}));

vi.mock("./api", () => ({
  fetchApplicationSettings: vi.fn(),
  fetchLanguages: vi.fn(),
  updateApplicationSettings: vi.fn(),
}));

vi.mock("@/app/hooks", () => ({
  useAntd: () => ({
    messageAPI: { error: mocks.messageError, success: mocks.messageSuccess },
    modalAPI: { confirm: mocks.modalConfirm },
  }),
  useCore: () => ({
    acceptSettings: mocks.acceptSettings,
    setLogos: mocks.setLogos,
    setThemePalettes: mocks.setThemePalettes,
    user: mocks.user,
  }),
}));

vi.mock("@/app/lib", () => ({
  getRoutePermissions: () => ({ canUpdate: mocks.canUpdate }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactI18next>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const settings: ApplicationSettings = {
  darkLogo: { id: "dark-logo", url: "/dark.svg" },
  darkTheme: {
    colorBgBase: "#141414",
    colorBgContainer: "#1f1f1f",
    colorBorder: "#424242",
    colorLink: "#1668dc",
    colorPrimary: "#1677ff",
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
    colorPrimary: "#1677ff",
    colorTextBase: "#000000",
    colorTextDescription: "#8c8c8c",
  },
};

beforeEach(() => {
  clearAccessToken();
  mocks.canUpdate = true;
  mocks.user.id = "settings-editor";
  mocks.user.isSystemAdmin = true;
  vi.mocked(fetchApplicationSettings).mockResolvedValue(settings);
  vi.mocked(fetchLanguages).mockResolvedValue([settings.language]);
  vi.mocked(updateApplicationSettings).mockResolvedValue(settings);
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((fulfill, fail) => {
    resolve = fulfill;
    reject = fail;
  });
  return { promise, reject, resolve };
};

const confirmSave = async (user: ReturnType<typeof render>["user"]) => {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "submit" }));
  return mocks.modalConfirm.mock.calls.at(-1)?.[0] as {
    onOk: () => Promise<void>;
    onCancel?: () => void;
  };
};

it("coalesces repeated confirmation clicks while a save is pending", async () => {
  const pending = deferred<ApplicationSettings>();
  vi.mocked(updateApplicationSettings).mockReturnValue(pending.promise);
  const { user } = render(<SettingsPage />);
  const confirmation = await confirmSave(user);
  await act(async () => {
    const completions = [confirmation.onOk(), confirmation.onOk()];
    pending.resolve(settings);
    await Promise.all(completions);
  });
  expect(updateApplicationSettings).toHaveBeenCalledOnce();
  expect(mocks.acceptSettings).toHaveBeenCalledOnce();
});

it.each(["permission", "language privilege", "session"])(
  "rejects an old confirmation after its %s changes",
  async (change) => {
    const { user, rerender } = render(<SettingsPage />);
    const confirmation = await confirmSave(user);
    if (change === "permission") mocks.canUpdate = false;
    if (change === "language privilege") mocks.user.isSystemAdmin = false;
    if (change === "session") setAccessToken("synthetic-next-session");
    rerender(<SettingsPage />);
    await act(async () => confirmation.onOk());
    expect(updateApplicationSettings).not.toHaveBeenCalled();
    expect(mocks.acceptSettings).not.toHaveBeenCalled();
  },
);

it.each(["unmount", "session change", "confirmation cancel"])(
  "does not accept an old settings save after %s",
  async (reason) => {
    const pending = deferred<ApplicationSettings>();
    vi.mocked(updateApplicationSettings).mockReturnValue(pending.promise);
    const { user, unmount, rerender } = render(<SettingsPage />);
    const confirmation = await confirmSave(user);
    let completion!: Promise<void>;
    act(() => {
      completion = confirmation.onOk();
    });
    if (reason === "unmount") unmount();
    else if (reason === "session change") {
      setAccessToken("synthetic-next-session");
      rerender(<SettingsPage />);
    } else act(() => confirmation.onCancel?.());
    await act(async () => {
      pending.resolve(settings);
      await completion;
    });
    expect(mocks.acceptSettings).not.toHaveBeenCalled();
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(vi.mocked(updateApplicationSettings).mock.calls[0][1]?.aborted).toBe(
      true,
    );
  },
);

it("loads, confirms, persists, and applies system settings", async () => {
  const { user } = render(<SettingsPage />);

  await screen.findByText("فارسی");
  await user.click(screen.getByRole("button", { name: "submit" }));

  const confirmation = mocks.modalConfirm.mock.calls.at(-1)?.[0] as {
    onOk: () => Promise<void>;
  };
  await confirmation.onOk();

  await waitFor(() => expect(updateApplicationSettings).toHaveBeenCalled());
  expect(mocks.acceptSettings).toHaveBeenCalledWith(settings);
  expect(mocks.messageSuccess).toHaveBeenCalledWith("settingsUpdated");
});

it("recovers from an initial settings timeout without displaying an editable empty form", async () => {
  vi.mocked(fetchApplicationSettings).mockRejectedValueOnce(
    new Error("Request timed out"),
  );
  const { user } = render(<SettingsPage />);
  await screen.findByText("Request timed out");
  expect(
    screen.queryByRole("button", { name: "submit" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "retry" }));
  await screen.findByText("فارسی");
  expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
  expect(fetchApplicationSettings).toHaveBeenCalledTimes(2);
  expect(updateApplicationSettings).not.toHaveBeenCalled();
  expect(mocks.messageError).not.toHaveBeenCalled();
});

it("lets ordinary settings editors save appearance without choosing or submitting language", async () => {
  mocks.user.isSystemAdmin = false;
  const { user } = render(<SettingsPage />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "submit" })).toBeEnabled(),
  );
  expect(
    screen.queryByRole("combobox", { name: /language$/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "submit" }));
  const confirmation = mocks.modalConfirm.mock.calls.at(-1)?.[0] as {
    onOk: () => Promise<void>;
  };
  await confirmation.onOk();
  const payload = vi.mocked(updateApplicationSettings).mock.calls.at(-1)?.[0];
  expect(payload).toMatchObject({
    darkTheme: settings.darkTheme,
    lightTheme: settings.lightTheme,
  });
  expect(payload).not.toHaveProperty("languageCode");
  expect(mocks.acceptSettings).toHaveBeenCalledWith(settings);
});

it("reports a current save failure without accepting unpersisted settings", async () => {
  vi.mocked(updateApplicationSettings).mockRejectedValue(
    new Error("Save failed"),
  );
  const { user } = render(<SettingsPage />);
  const confirmation = await confirmSave(user);
  await act(async () => confirmation.onOk());
  expect(mocks.messageError).toHaveBeenCalledWith("Save failed");
  expect(mocks.acceptSettings).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "submit" })).toBeEnabled();
});

it("ignores a rethrown save error after leaving before its consumer continuation", async () => {
  const pending = deferred<ApplicationSettings>();
  vi.mocked(updateApplicationSettings).mockReturnValue(pending.promise);
  const { user, unmount } = render(<SettingsPage />);
  const confirmation = await confirmSave(user);
  let completion!: Promise<void>;
  act(() => {
    completion = confirmation.onOk();
  });
  await act(async () => {
    pending.reject(new Error("Obsolete failure"));
    queueMicrotask(unmount);
    await completion;
  });
  expect(mocks.messageError).not.toHaveBeenCalled();
  expect(mocks.acceptSettings).not.toHaveBeenCalled();
});

it("keeps read-only palette values visible without opening editing or submitting", async () => {
  mocks.canUpdate = false;
  const { user } = render(<SettingsPage />);
  const paletteValues = await screen.findAllByText("#FFFFFF");

  expect(screen.getByRole("button", { name: "submit" })).toBeDisabled();
  await user.click(paletteValues[0]);
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "submit" }));
  expect(mocks.modalConfirm).not.toHaveBeenCalled();
  expect(updateApplicationSettings).not.toHaveBeenCalled();
});
