import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, mocked } from "storybook/test";

import {
  assertNoUnexpectedRequests,
  resetRequestGuard,
} from "../../../.storybook/request-guard";

import { apiClient } from "@/shared/api";
import { fetchUser, fetchUsers, updateUserRoles } from "@/features/users/api";
import {
  fetchApplicationSettings,
  updateApplicationSettings,
} from "@/features/settings/api";
import { uploadFile } from "@/features/settings/components/logo-upload/api";

const meta = {
  render: () => <h1>Synthetic API isolation</h1>,
  title: "Verification/Transport",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnexpectedRequest: Story = {
  play: async () => {
    await expect(assertNoUnexpectedRequests).not.toThrow();
    const requests = [
      [apiClient.blob, "GET(blob)"],
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
      await expect(mocked(request)).toHaveBeenCalledOnce();
    }
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
    const updated = await fetchUser("user-1");
    await expect(updated.roles).toEqual([
      { id: "role-editor", name: "Editor" },
    ]);
    const listed = await fetchUsers({});
    await expect(listed.items.find(({ id }) => id === "user-1")?.roles).toEqual(
      updated.roles,
    );
    updated.roles[0].name = "Changed outside the fixture";
    await expect(fetchUser("user-1")).resolves.toMatchObject({
      roles: [{ id: "role-editor", name: "Editor" }],
    });
  },
};

export const SavedUploadedLogos: Story = {
  play: async () => {
    const original = await fetchApplicationSettings();
    const darkLogo = await uploadFile(
      new File(["dark synthetic logo"], "dark.svg", { type: "image/svg+xml" }),
      "public",
    );
    const lightLogo = await uploadFile(
      new File(["light synthetic logo"], "light.svg", {
        type: "image/svg+xml",
      }),
      "public",
    );
    const accepted = await updateApplicationSettings({
      darkLogoId: darkLogo.id,
      darkTheme: original.darkTheme,
      lightLogoId: lightLogo.id,
      lightTheme: original.lightTheme,
    });
    await expect(accepted).toMatchObject({
      darkLogo: { id: darkLogo.id, url: "/logo.svg" },
      language: original.language,
      lightLogo: { id: lightLogo.id, url: "/logo.svg" },
    });
    await expect(fetchApplicationSettings()).resolves.toEqual(accepted);
    accepted.darkLogo!.url = "/changed-outside-fixture.svg";
    await expect(fetchApplicationSettings()).resolves.toMatchObject({
      darkLogo: { id: darkLogo.id, url: "/logo.svg" },
    });
    await updateApplicationSettings({
      darkTheme: original.darkTheme,
      lightTheme: original.lightTheme,
    });
    await expect(fetchApplicationSettings()).resolves.toMatchObject({
      darkLogo: undefined,
      language: original.language,
      lightLogo: undefined,
    });
  },
};
