import { mocked } from "storybook/test";

import type { SettingsRequest } from "@/features/settings";
import { apiClient, setUnauthorizedHandler } from "@/shared/api";
import { clearAccessToken } from "@/shared/api";

import {
  permissions,
  roles as initialRoles,
  sampleAccount,
  sampleFiles,
  sampleLanguages,
  sampleSettings,
  users as initialUsers,
} from "./fixtures";
import { rejectUnexpectedRequest, resetRequestGuard } from "./request-guard";

export { assertNoUnexpectedRequests } from "./request-guard";

export const resetStoryMocks = (state = "populated") => {
  resetRequestGuard();
  clearAccessToken();
  mocked(setUnauthorizedHandler).mockReset();
  let roles = state === "roles-empty" ? [] : structuredClone(initialRoles);
  let users = state === "users-empty" ? [] : structuredClone(initialUsers);
  let files = state === "files-empty" ? [] : structuredClone(sampleFiles);
  let settings = structuredClone(sampleSettings);
  const account = structuredClone(sampleAccount);
  let calendar = ["2026-09-15", "2026-09-23"];
  let settingsAttempts = 0;
  mocked(apiClient.get)
    .mockReset()
    .mockImplementation(async (url) => {
      if (url === "/settings") {
        settingsAttempts += 1;
        if (state === "settings-retry" && settingsAttempts === 1)
          throw new Error("Synthetic settings failure");
        return structuredClone(settings);
      }
      if (url === "/languages")
        return structuredClone(
          Object.values(sampleLanguages).map((language) => ({
            ...language,
            calendar:
              language.calendar === "gregorian" ? "gregory" : language.calendar,
          })),
        );
      if (url === "/account/me") {
        if (state === "account-loading") return new Promise(() => undefined);
        if (state === "account-error")
          throw new Error("Synthetic account unavailable");
        return structuredClone(account);
      }
      if (url === "/calendar") return [...calendar];
      if (url === "/roles/permissions") return structuredClone(permissions);
      if (url === "/files") {
        if (state === "files-loading") return new Promise(() => undefined);
        if (state === "files-error")
          throw new Error("Synthetic files unavailable");
        return structuredClone(files);
      }
      if (url === "/roles" || url === "/users") {
        const resource = url.slice(1);
        if (state === `${resource}-loading`)
          return new Promise(() => undefined);
        if (state === `${resource}-error`)
          throw new Error(`Synthetic ${resource} unavailable`);
        return url === "/roles"
          ? structuredClone(roles)
          : { items: structuredClone(users), total: users.length };
      }
      const role = roles.find(({ id }) => url === `/roles/${id}`);
      if (role) return structuredClone(role);
      const user = users.find(({ id }) => url === `/users/${id}`);
      if (user) return structuredClone(user);
      return rejectUnexpectedRequest("GET", url);
    });
  mocked(apiClient.post)
    .mockReset()
    .mockImplementation(async (url, request) => {
      if (url === "/auth/login" || url === "/auth/register")
        return { accessToken: "synthetic-story-token" };
      if (url === "/auth/otp-request")
        return { expiresIn: 300, remainingSeconds: 60 };
      if (
        [
          "/auth/forgot-password",
          "/auth/change-password",
          "/auth/logout",
        ].includes(url)
      )
        return undefined;
      if (url === "/calendar") {
        calendar.push((request as { date: string }).date);
        return undefined;
      }
      if (url === "/roles") {
        const created = {
          id: "role-created",
          ...(request as Pick<(typeof roles)[number], "name" | "permissions">),
        };
        roles.push(created);
        return structuredClone(created);
      }
      if (url === "/users") {
        const created = {
          id: "user-created",
          roles: [],
          isSystemAdmin: false,
          ...(request as Pick<
            (typeof users)[number],
            "firstName" | "lastName" | "mobile" | "status"
          >),
        };
        users.push(created);
        return structuredClone(created);
      }
      return rejectUnexpectedRequest("POST", url);
    });
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
      if (
        url.startsWith("/calendar/") &&
        calendar.includes(url.slice("/calendar/".length))
      ) {
        calendar = calendar.filter((date) => url !== `/calendar/${date}`);
        return undefined;
      }
      if (roles.some(({ id }) => url === `/roles/${id}`)) {
        roles = roles.filter(({ id }) => url !== `/roles/${id}`);
        return undefined;
      }
      if (users.some(({ id }) => url === `/users/${id}`)) {
        users = users.filter(({ id }) => url !== `/users/${id}`);
        return undefined;
      }
      if (files.some(({ id, isUsed }) => url === `/files/${id}` && !isUsed)) {
        files = files.filter(({ id }) => url !== `/files/${id}`);
        return undefined;
      }
      return rejectUnexpectedRequest("DELETE", url);
    });
  mocked(apiClient.put)
    .mockReset()
    .mockImplementation(async (url, request) => {
      if (url === "/settings") {
        const { darkLogoId, lightLogoId, languageCode, ...values } =
          request as SettingsRequest;
        const language =
          Object.values(sampleLanguages).find(
            ({ code }) => code === languageCode,
          ) ?? settings.language;
        settings = {
          ...settings,
          ...values,
          language: {
            ...language,
            calendar:
              language.calendar === "gregorian" ? "gregory" : language.calendar,
          },
          darkLogo: files.find(({ id }) => id === darkLogoId),
          lightLogo: files.find(({ id }) => id === lightLogoId),
        };
        return structuredClone(settings);
      }
      if (users.some(({ id }) => url === `/users/${id}/password`))
        return undefined;
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
        url: "/logo.svg",
        size: (request as { file: File }).file.size,
        isUsed: false,
      };
      files.push(created);
      return structuredClone(created);
    });
};
