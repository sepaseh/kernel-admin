import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ImageUpload } from "@/shared/ui/image-upload";

const preview =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#0958d9"/><text x="128" y="140" text-anchor="middle" fill="white" font-size="32">Logo</text></svg>',
  );
const meta = {
  title: "Shared/ImageUpload",
  component: ImageUpload,
  args: {
    label: "Organization logo",
    onError: fn(),
    onChange: fn(),
    settings: { width: 256, height: 256, size: 1_000_000 },
    upload: fn(async () => ({ id: "image-1", url: preview })),
  },
} satisfies Meta<typeof ImageUpload>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const ExistingImage: Story = {
  args: { value: { id: "image-1", url: preview }, disabled: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "Organization logo" }),
    ).toBeVisible();
  },
};
export const RejectsUnsupportedFiles: Story = {
  play: async ({ args, canvasElement }) => {
    const input =
      canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Upload input is missing");
    await userEvent.upload(
      input,
      new File(["synthetic"], "example.txt", { type: "text/plain" }),
      { applyAccept: false },
    );
    await expect(args.onError).toHaveBeenCalledWith(expect.any(Error));
    await expect(args.upload).not.toHaveBeenCalled();
  },
};
