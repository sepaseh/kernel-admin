import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { uploadFile } from "@/features/files";
import { fetchSettings, updateSettings } from "@/features/settings";
import { fetchUser, fetchUsers, updateUserRoles } from "@/features/users";
import { apiClient } from "@/shared/api";
import {
  assertNoUnexpectedRequests,
  resetRequestGuard,
} from "../../../.storybook/request-guard";

import { apiClient } from "@/shared/api";
import { fetchUser, fetchUsers, updateUserRoles } from "@/features/users/api";
import { fetchSettings, updateSettings } from "@/features/settings/api";
import { uploadFile } from "@/features/files/api";

const meta = {
  title: "Verification/Transport",
  render: () => <h1>Synthetic API isolation</h1>,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const UnexpectedRequest: Story = {
  play: async () => {
    await expect(assertNoUnexpectedRequests).not.toThrow();
    const requests = [
      [apiClient.get, "GET"],
      [apiClient.post, "POST"],
      [apiClient.put, "PUT"],
      [apiClient.patch, "PATCH"],
      [apiClient.del, "DELETE"],
    ] as const;
    for (const [request, method] of requests) {
      await expect(request("/__unexpected_storybook_probe__")).rejects.toThrow(
        `Unexpected synthetic API request: ${method}`,
      );
    } finally {
      // This is the intentional negative probe; other stories never clear failures.
      resetRequestGuard();
    }
    await expect(
      apiClient.upload("/__unexpected_storybook_probe__", {}),
    ).rejects.toThrow("Unexpected synthetic API request: UPLOAD");
    await expect(mocked(apiClient.upload)).toHaveBeenCalledOnce();
    await expect(assertNoUnexpectedRequests).toThrow(
      "UPLOAD /__unexpected_storybook_probe__",
    );
    await expect(assertNoUnexpectedRequests).toThrow(
      "DELETE /__unexpected_storybook_probe__",
    );
    // This story deliberately exercises the failure boundary; ordinary stories never reset it.
    resetRequestGuard();
    await expect(assertNoUnexpectedRequests).not.toThrow();
  },
};

export const SavedUserRoles: Story = {
  play: async () => {
    await updateUserRoles("user-1", { roleIds: ["role-editor"] });
    const accepted = await fetchUser("user-1");
    await expect(accepted.roles).toEqual([
      { id: "role-editor", name: "Editor" },
    ]);
    await expect(
      (await fetchUsers({})).items.find(({ id }) => id === "user-1")?.roles,
    ).toEqual(accepted.roles);
    accepted.roles[0].name = "Changed outside the synthetic service";
    await expect(fetchUser("user-1")).resolves.toMatchObject({
      roles: [{ id: "role-editor", name: "Editor" }],
    });
  },
};

export const SavedUploadedLogos: Story = {
  play: async () => {
    const original = await fetchSettings();
    const darkLogo = await uploadFile(
      new File(["dark synthetic logo"], "dark.svg", { type: "image/svg+xml" }),
      "logo",
    );
    const lightLogo = await uploadFile(
      new File(["light synthetic logo"], "light.svg", {
        type: "image/svg+xml",
      }),
      "logo",
    );
    const accepted = await updateSettings({
      darkLogoId: darkLogo.id,
      lightLogoId: lightLogo.id,
      lightTheme: original.lightTheme,
      imageSettings: original.imageSettings,
    });
    await expect(accepted).toMatchObject({
      darkLogo: { id: darkLogo.id, url: "/logo.svg" },
      language: original.language,
      lightLogo: { id: lightLogo.id, url: "/logo.svg" },
    });
    await expect(fetchSettings()).resolves.toEqual(accepted);
    accepted.darkLogo!.url = "/changed-outside-fixture.svg";
    await expect(fetchSettings()).resolves.toMatchObject({
      darkLogo: { id: darkLogo.id, url: "/logo.svg" },
    });
    await updateSettings({
      darkTheme: original.darkTheme,
      imageSettings: original.imageSettings,
      lightTheme: original.lightTheme,
    });
    await expect(fetchSettings()).resolves.toMatchObject({
      darkLogo: undefined,
      language: original.language,
      lightLogo: undefined,
    });
    await updateSettings(values);
    const cleared = await fetchSettings();
    await expect(cleared.darkLogo).toBeUndefined();
    await expect(cleared.lightLogo).toBeUndefined();
  },
};
