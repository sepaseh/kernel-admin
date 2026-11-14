import { mocked } from "storybook/test";

import * as accountAPI from "@/features/account/api";
import * as authAPI from "@/features/auth/api";
import * as calendarAPI from "@/features/calendar/api";
import * as rolesAPI from "@/features/roles/api";
import type { Settings, SettingsRequest } from "@/features/settings/types";
import * as usersAPI from "@/features/users/api";
import { apiClient, setUnauthorizedHandler } from "@/shared/api";
import {
  samplePermissions,
  sampleRoles,
  sampleSettings,
  sampleUser,
  sampleUsers,
  sampleFiles,
  sampleLanguages,
  sampleSettings,
  sampleFiles,
  users,
} from "@/test/storybook/fixtures";

export { assertNoUnexpectedRequests } from "./request-guard";

export const resetStoryMocks = () => {
  resetRequestGuard();
  let account = structuredClone(sampleAccount);
  let roleList = structuredClone(roles);
  let userList = structuredClone(users);
  let calendarDates = ["2026-09-15", "2026-09-23"];
  let settings: Settings = structuredClone(sampleSettings);
  let files = structuredClone(sampleFiles);
  let sequence = 0;

  mocked(apiClient.get)
    .mockReset()
    .mockImplementation(async (url) => {
      if (url === "/settings") return structuredClone(settings);
      if (url === "/languages")
        return Object.values(sampleLanguages).map((language) => ({
          ...language,
          calendar:
            language.calendar === "gregorian" ? "gregory" : language.calendar,
        }));
      if (url === "/files") return structuredClone(files);
      return rejectUnexpectedRequest("GET", url);
    });
  mocked(apiClient.post)
    .mockReset()
    .mockImplementation(async (url) => rejectUnexpectedRequest("POST", url));
  mocked(apiClient.patch)
    .mockReset()
    .mockImplementation(async (url, request) => {
      if (url === "/account/update-profile") {
        Object.assign(account, request);
        return structuredClone(account);
      }
      const role = roles.find(({ id }) => url === `/roles/${id}`);
      if (role) {
        Object.assign(role, request);
        return structuredClone(role);
      }
      const user = users.find(
        ({ id }) =>
          url === `/users/${id}` ||
          url === `/users/${id}/status` ||
          url === `/users/${id}/system-admin`,
      );
      if (user) {
        Object.assign(user, request);
        return structuredClone(user);
      }
      return rejectUnexpectedRequest("PATCH", url);
    });
  mocked(apiClient.del)
    .mockReset()
    .mockImplementation(async (url) => {
      if (files.some(({ id, isUsed }) => url === `/files/${id}` && !isUsed)) {
        files = files.filter(({ id }) => url !== `/files/${id}`);
        return undefined;
      }
      return rejectUnexpectedRequest("DELETE", url);
    });
  mocked(apiClient.put)
    .mockReset()
    .mockImplementation(async (url, request) => {
      if (url !== "/settings") return rejectUnexpectedRequest("PUT", url);
      const { darkLogoId, lightLogoId, languageCode, ...values } =
        request as SettingsRequest;
      const language = Object.values(sampleLanguages).find(
        ({ code }) => code === languageCode,
      );
      settings = {
        ...settings,
        ...values,
        darkLogo: files.find(({ id }) => id === darkLogoId),
        lightLogo: files.find(({ id }) => id === lightLogoId),
        language: language
          ? {
              ...language,
              calendar:
                language.calendar === "gregorian"
                  ? "gregory"
                  : language.calendar,
            }
          : settings.language,
      };
      return structuredClone(settings);
    });
  mocked(apiClient.upload)
    .mockReset()
    .mockImplementation(async (url, request) => {
      if (url !== "/files") return rejectUnexpectedRequest("UPLOAD", url);
      const uploaded = {
        id: `story-upload-${++sequence}`,
        url: "/logo.svg",
        size: (request as { file: File }).file.size,
        isUsed: false,
      };
      files.push(uploaded);
      return structuredClone(uploaded);
    });
  mocked(setUnauthorizedHandler).mockReset();

  mocked(accountAPI.getAccount)
    .mockReset()
    .mockImplementation(async (url, request) => {
      if (url === "/settings") {
        const { darkLogoId, lightLogoId, languageCode, ...values } =
          request as SettingsRequest;
        const language =
          sampleLanguages.find(({ code }) => code === languageCode) ??
          settings.language;
        settings = {
          ...settings,
          ...values,
          language,
          darkLogo: files.find(({ id }) => id === darkLogoId),
          lightLogo: files.find(({ id }) => id === lightLogoId),
        };
        return structuredClone(settings);
      }
      const user = users.find(({ id }) => url === `/users/${id}/roles`);
      if (user) {
        user.roles = roles
          .filter(({ id }) =>
            (request as { roleIds: string[] }).roleIds.includes(id),
          )
          .map(({ id, name }) => ({ id, name }));
        return undefined;
      }
      return rejectUnexpectedRequest("PUT", url);
    });
  mocked(apiClient.upload)
    .mockReset()
    .mockImplementation(async (url, request) => {
      if (url !== "/files") return rejectUnexpectedRequest("UPLOAD", url);
      const created = {
        id: `file-uploaded-${files.length}`,
        url: sampleFiles[0].url,
        size: (request as { file: File }).file.size,
        isUsed: false,
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
};
