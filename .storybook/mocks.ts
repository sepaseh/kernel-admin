import { mocked } from "storybook/test";

import * as accountAPI from "@/features/account/api";
import * as authAPI from "@/features/auth/api";
import * as calendarAPI from "@/features/calendar/api";
import * as rolesAPI from "@/features/roles/api";
import * as settingsAPI from "@/features/settings/api";
import * as uploadAPI from "@/features/settings/components/logo-upload/api";
import type { ApplicationSettings } from "@/features/settings/types";
import * as usersAPI from "@/features/users/api";
import { apiClient, setUnauthorizedHandler } from "@/shared/api";
import type { Theme } from "@/shared/config";
import { createThemeConfig, themeColorFields } from "@/shared/config";
import type { ThemeColors } from "@/shared/contracts/appearance";
import {
  permissions,
  roles,
  sampleAccount,
  sampleLanguages,
  users,
} from "@/test/storybook/fixtures";

import {
  assertNoUnexpectedRequests,
  rejectUnexpectedRequest,
  resetRequestGuard,
} from "./request-guard";

const palette = (theme: Theme): ThemeColors => {
  const token = createThemeConfig(theme).token;
  return Object.fromEntries(
    themeColorFields.map((field) => {
      const value = token?.[field];
      if (typeof value !== "string")
        throw new Error(`Missing synthetic palette field: ${field}`);
      return [field, value];
    }),
  ) as ThemeColors;
};

export const resetStoryMocks = (initialSettings?: ApplicationSettings) => {
  resetRequestGuard();
  let account = structuredClone(sampleAccount);
  let roleList = structuredClone(roles);
  let userList = structuredClone(users);
  let calendarDates = ["2026-09-15", "2026-09-23"];
  let settings: ApplicationSettings = structuredClone(
    initialSettings ?? {
      darkTheme: palette("dark"),
      language: sampleLanguages.en,
      lightTheme: palette("light"),
    },
  );
  const uploadedLogos = new Map<string, { id: string; url: string }>();
  for (const logo of [settings.darkLogo, settings.lightLogo]) {
    if (logo) uploadedLogos.set(logo.id, structuredClone(logo));
  }
  const findLogo = (id: string | undefined) => {
    if (id === undefined) return undefined;
    const logo = uploadedLogos.get(id);
    if (!logo) throw new Error(`Unknown synthetic logo: ${id}`);
    return structuredClone(logo);
  };
  let sequence = 0;

  mocked(apiClient.get)
    .mockReset()
    .mockImplementation(async (url) => rejectUnexpectedRequest("GET", url));
  mocked(apiClient.blob)
    .mockReset()
    .mockImplementation(async (url) =>
      rejectUnexpectedRequest("GET(blob)", url),
    );
  mocked(apiClient.post)
    .mockReset()
    .mockImplementation(async (url) => rejectUnexpectedRequest("POST", url));
  mocked(apiClient.put)
    .mockReset()
    .mockImplementation(async (url) => rejectUnexpectedRequest("PUT", url));
  mocked(apiClient.patch)
    .mockReset()
    .mockImplementation(async (url) => rejectUnexpectedRequest("PATCH", url));
  mocked(apiClient.del)
    .mockReset()
    .mockImplementation(async (url) => rejectUnexpectedRequest("DELETE", url));
  mocked(setUnauthorizedHandler).mockReset();

  mocked(accountAPI.getAccount)
    .mockReset()
    .mockImplementation(async () => structuredClone(account));
  mocked(accountAPI.requestEmailVerification)
    .mockReset()
    .mockResolvedValue({ expiresIn: 120, remainingSeconds: 30 });
  mocked(accountAPI.updateProfile)
    .mockReset()
    .mockImplementation(async ({ firstName, lastName }) => {
      account = {
        ...account,
        firstName: firstName?.trim() || account.firstName,
        lastName: lastName?.trim() || account.lastName,
      };
      return structuredClone(account);
    });
  mocked(accountAPI.updateUsername)
    .mockReset()
    .mockImplementation(async ({ username }) => {
      account = { ...account, username };
      return structuredClone(account);
    });
  mocked(accountAPI.verifyEmail)
    .mockReset()
    .mockImplementation(async ({ email }) => {
      account = { ...account, email };
    });
  mocked(authAPI.changePassword).mockReset().mockResolvedValue(undefined);
  mocked(authAPI.forgotPassword).mockReset().mockResolvedValue(undefined);
  mocked(authAPI.login)
    .mockReset()
    .mockResolvedValue({ accessToken: "synthetic-storybook-token" });
  mocked(authAPI.logout).mockReset().mockResolvedValue(undefined);
  mocked(authAPI.register)
    .mockReset()
    .mockResolvedValue({ accessToken: "synthetic-storybook-token" });
  mocked(authAPI.requestOtp)
    .mockReset()
    .mockResolvedValue({ expiresIn: 120, remainingSeconds: 30 });

  mocked(rolesAPI.fetchPermissions)
    .mockReset()
    .mockResolvedValue(structuredClone(permissions));
  mocked(rolesAPI.fetchRole)
    .mockReset()
    .mockImplementation(async (id) => {
      const role = roleList.find((item) => item.id === id);
      if (!role) throw new Error(`Unknown synthetic role: ${id}`);
      return structuredClone(role);
    });
  mocked(rolesAPI.fetchRoles)
    .mockReset()
    .mockImplementation(async () => structuredClone(roleList));
  mocked(rolesAPI.createRole)
    .mockReset()
    .mockImplementation(async (params) => {
      const role = { ...params, id: `story-role-${++sequence}` };
      roleList.push(role);
      return structuredClone(role);
    });
  mocked(rolesAPI.updateRole)
    .mockReset()
    .mockImplementation(async (id, params) => {
      const role = { ...params, id };
      roleList = roleList.map((item) => (item.id === id ? role : item));
      return structuredClone(role);
    });
  mocked(rolesAPI.deleteRole)
    .mockReset()
    .mockImplementation(async (id) => {
      roleList = roleList.filter((item) => item.id !== id);
    });

  mocked(usersAPI.fetchUser)
    .mockReset()
    .mockImplementation(async (id) => {
      const user = userList.find((item) => item.id === id);
      if (!user) throw new Error(`Unknown synthetic user: ${id}`);
      return structuredClone(user);
    });
  mocked(usersAPI.fetchUsers)
    .mockReset()
    .mockImplementation(async () => ({
      items: structuredClone(userList),
      total: userList.length,
    }));
  mocked(usersAPI.createUser)
    .mockReset()
    .mockImplementation(async ({ firstName, lastName, mobile }) => {
      const user = {
        firstName,
        id: `story-user-${++sequence}`,
        isSystemAdmin: false,
        lastName,
        mobile,
        roles: [],
        status: "active" as const,
      };
      userList.push(user);
      return structuredClone(user);
    });
  mocked(usersAPI.updateUser)
    .mockReset()
    .mockImplementation(async (id, params) => {
      const current = userList.find((item) => item.id === id);
      if (!current) throw new Error(`Unknown synthetic user: ${id}`);
      const user = { ...current, ...params };
      userList = userList.map((item) => (item.id === id ? user : item));
      return structuredClone(user);
    });
  mocked(usersAPI.deleteUser)
    .mockReset()
    .mockImplementation(async (id) => {
      userList = userList.filter((item) => item.id !== id);
    });
  mocked(usersAPI.updateUserPassword).mockReset().mockResolvedValue(undefined);
  mocked(usersAPI.updateUserRoles)
    .mockReset()
    .mockImplementation(async (id, { roleIds }) => {
      if (!userList.some((user) => user.id === id))
        throw new Error(`Unknown synthetic user: ${id}`);
      const selectedRoles = roleIds.map((roleId) => {
        const role = roleList.find((item) => item.id === roleId);
        if (!role) throw new Error(`Unknown synthetic role: ${roleId}`);
        return { id: role.id, name: role.name };
      });
      userList = userList.map((user) =>
        user.id === id ? { ...user, roles: selectedRoles } : user,
      );
    });
  mocked(usersAPI.updateUserStatus)
    .mockReset()
    .mockImplementation(async (id, params) => {
      userList = userList.map((user) =>
        user.id === id ? { ...user, ...params } : user,
      );
    });
  mocked(usersAPI.updateUserSystemAdmin)
    .mockReset()
    .mockImplementation(async (id, params) => {
      userList = userList.map((user) =>
        user.id === id ? { ...user, ...params } : user,
      );
    });

  mocked(calendarAPI.fetchCalendarDates)
    .mockReset()
    .mockImplementation(async () => [...calendarDates]);
  mocked(calendarAPI.createCalendarDate)
    .mockReset()
    .mockImplementation(async (date) => {
      calendarDates = [...calendarDates, date];
    });
  mocked(calendarAPI.deleteCalendarDate)
    .mockReset()
    .mockImplementation(async (date) => {
      calendarDates = calendarDates.filter((item) => item !== date);
    });
  mocked(settingsAPI.fetchApplicationSettings)
    .mockReset()
    .mockImplementation(async () => structuredClone(settings));
  mocked(settingsAPI.fetchLanguages)
    .mockReset()
    .mockResolvedValue([sampleLanguages.en, sampleLanguages.fa]);
  mocked(settingsAPI.updateApplicationSettings)
    .mockReset()
    .mockImplementation(async (params) => {
      if (params.languageCode && !["en", "fa"].includes(params.languageCode))
        throw new Error("Unsupported synthetic language fixture");
      settings = {
        ...settings,
        darkLogo: findLogo(params.darkLogoId),
        darkTheme: params.darkTheme,
        lightLogo: findLogo(params.lightLogoId),
        lightTheme: params.lightTheme,
        language:
          params.languageCode === "fa"
            ? sampleLanguages.fa
            : params.languageCode === "en"
              ? sampleLanguages.en
              : settings.language,
      };
      return structuredClone(settings);
    });
  mocked(uploadAPI.uploadFile)
    .mockReset()
    .mockImplementation(async (file, visibility) => {
      const uploaded = {
        contentType: file.type || "image/svg+xml",
        id: `story-upload-${++sequence}`,
        url: "/logo.svg",
        visibility,
      };
      uploadedLogos.set(uploaded.id, { id: uploaded.id, url: uploaded.url });
      return uploaded;
    });
};

export { assertNoUnexpectedRequests };
