import { mocked } from "storybook/test";
import { apiClient } from "@/shared/api";
import type { SettingsRequest } from "@/features/settings";
import {
  sampleFaqs,
  samplePermissions,
  sampleRoles,
  sampleSettings,
  sampleUser,
  sampleUsers,
  sampleFiles,
  sampleLanguages,
} from "./fixtures";
import { rejectUnexpectedRequest, resetRequestGuard } from "./request-guard";

export { assertNoUnexpectedRequests } from "./request-guard";

export const resetStoryMocks = (state = "populated") => {
  resetRequestGuard();
  let faqs = state === "empty" ? [] : structuredClone(sampleFaqs);
  let roles = state === "roles-empty" ? [] : structuredClone(sampleRoles);
  let users = state === "users-empty" ? [] : structuredClone(sampleUsers);
  let files = state === "files-empty" ? [] : structuredClone(sampleFiles);
  let settings = structuredClone(sampleSettings);
  const account = structuredClone(sampleUser);
  let calendar: string[] = [];
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
      if (url === "/languages") return structuredClone(sampleLanguages);
      if (url === "/account/me") {
        if (state === "account-loading") return new Promise(() => undefined);
        if (state === "account-error")
          throw new Error("Synthetic account unavailable");
        return structuredClone(account);
      }
      if (url === "/calendar") return [...calendar];
      if (url === "/roles/permissions")
        return structuredClone(samplePermissions);
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
      if (url === "/faqs") {
        if (state === "loading") return new Promise(() => undefined);
        if (state === "error")
          throw new Error("Synthetic FAQ service unavailable");
        return structuredClone(faqs);
      }
      const item = faqs.find(({ id }) => url === `/faqs/${id}`);
      if (item) return structuredClone(item);
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
      if (url !== "/faqs") return rejectUnexpectedRequest("POST", url);
      const created = {
        id: "faq-created",
        ...(request as { question: string; answer: string }),
      };
      faqs = [...faqs, created];
      return structuredClone(created);
    });
  mocked(apiClient.patch)
    .mockReset()
    .mockImplementation(async (url, request) => {
      if (url === "/account/update-profile") {
        Object.assign(account, request);
        return structuredClone(account);
      }
      if (url === "/faqs/sort") {
        const ids = (request as { ids: string[] }).ids;
        faqs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        return undefined;
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
      const item = faqs.find(({ id }) => url === `/faqs/${id}`);
      if (!item) return rejectUnexpectedRequest("PATCH", url);
      Object.assign(item, request);
      return structuredClone(item);
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
      const item = faqs.find(({ id }) => url === `/faqs/${id}`);
      if (!item) return rejectUnexpectedRequest("DELETE", url);
      faqs = faqs.filter(({ id }) => id !== item.id);
      return undefined;
    });
  mocked(apiClient.put)
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
      files.push(created);
      return structuredClone(created);
    });
};
