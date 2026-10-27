import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";

import { i18nInstance } from "@/shared/i18n";
import { StoryShell } from "@/test/storybook/StoryShell";

import { uploadFile } from "./api";
import { LogoUpload } from "./LogoUpload";

const meta = {
  component: LogoUpload,
  parameters: { layout: "centered" },
  render: (args) => (
    <StoryShell>
      <div style={{ width: 240 }}>
        <LogoUpload {...args} />
      </div>
    </StoryShell>
  ),
  title: "Features/Settings/LogoUpload",
} satisfies Meta<typeof LogoUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", {
        name: i18nInstance.t("logo"),
      }),
    ).toBeEnabled();
  },
};

export const CurrentLogo: Story = {
  args: { url: "/logo.svg", value: "logo-1" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("img", { name: i18nInstance.t("logo") }),
    ).toHaveAttribute("src", "/logo.svg");
    await expect(
      canvas.getByRole("button", { name: i18nInstance.t("logo") }),
    ).toBeEnabled();
  },
};

export const ReadOnly: Story = {
  render: (args) => (
    <StoryShell withUser={false}>
      <LogoUpload {...args} />
    </StoryShell>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", {
        name: i18nInstance.t("logo"),
      }),
    ).toBeDisabled();
  },
};

export const CancelPendingUpload: Story = {
  args: { onChange: fn() },
  beforeEach() {
    mocked(uploadFile).mockReturnValue(new Promise(() => undefined));
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input =
      canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Logo file selector is missing");
    await userEvent.upload(
      input,
      new File(["synthetic logo"], "logo.png", { type: "image/png" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: i18nInstance.t("cancel") }),
    );
    await waitFor(() =>
      expect(mocked(uploadFile).mock.calls[0]?.[2]?.aborted).toBe(true),
    );
    await expect(args.onChange).not.toHaveBeenCalledWith(expect.any(String));
    await expect(
      canvas.queryByRole("button", { name: i18nInstance.t("cancel") }),
    ).not.toBeInTheDocument();
  },
};
