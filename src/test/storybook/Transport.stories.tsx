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

const meta = {
  title: "Verification/Transport",
  render: () => <h1>Synthetic API isolation</h1>,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const UnexpectedRequest: Story = {
  play: async () => {
    await expect(assertNoUnexpectedRequests).not.toThrow();
    try {
      for (const [method, request] of [
        ["GET", apiClient.get],
        ["POST", apiClient.post],
        ["PUT", apiClient.put],
        ["PATCH", apiClient.patch],
        ["DELETE", apiClient.del],
      ] as const) {
        await expect(
          request("/__unexpected_storybook_probe__"),
        ).rejects.toThrow(`Unexpected synthetic API request: ${method}`);
      }
      await expect(
        apiClient.upload("/__unexpected_storybook_probe__", {
          file: new File(["synthetic"], "probe.png"),
          context: "logo",
        }),
      ).rejects.toThrow("Unexpected synthetic API request: UPLOAD");
      await expect(assertNoUnexpectedRequests).toThrow(
        "UPLOAD /__unexpected_storybook_probe__",
      );
    } finally {
      // This is the intentional negative probe; other stories never clear failures.
      resetRequestGuard();
    }
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
      new File(["dark synthetic logo"], "dark.png", { type: "image/png" }),
      "logo",
    );
    const lightLogo = await uploadFile(
      new File(["light synthetic logo"], "light.png", { type: "image/png" }),
      "logo",
    );
    const values = {
      darkTheme: original.darkTheme,
      lightTheme: original.lightTheme,
      imageSettings: original.imageSettings,
    };
    const accepted = await updateSettings({
      ...values,
      darkLogoId: darkLogo.id,
      lightLogoId: lightLogo.id,
    });
    await expect(accepted.darkLogo?.id).toBe(darkLogo.id);
    await expect(accepted.lightLogo?.id).toBe(lightLogo.id);
    await expect(fetchSettings()).resolves.toEqual(accepted);
    if (!accepted.darkLogo)
      throw new Error("The fixture did not retain its accepted logo");
    accepted.darkLogo.url = "/changed-outside-fixture.png";
    await expect(fetchSettings()).resolves.toMatchObject({
      darkLogo: { id: darkLogo.id, url: darkLogo.url },
    });
    await updateSettings(values);
    const cleared = await fetchSettings();
    await expect(cleared.darkLogo).toBeUndefined();
    await expect(cleared.lightLogo).toBeUndefined();
  },
};
