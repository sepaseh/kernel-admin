// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Upload, type UploadProps } from "antd";
import type ImgCrop from "antd-img-crop";
import { cloneElement, type ComponentProps, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/shared/i18n";
import { deferred } from "@/test/deferred";

import { readImageSize } from "./image";
import { ImageUpload } from "./ImageUpload";

const cropOutput = vi.hoisted(() => ({
  contents: undefined as string | undefined,
}));

vi.mock("./image", () => ({ readImageSize: vi.fn() }));
vi.mock("antd-img-crop", () => ({
  // jsdom cannot crop canvas images; retain Upload's real file-input/request lifecycle.
  default: ({ beforeCrop, children }: ComponentProps<typeof ImgCrop>) => {
    const child = children as ReactElement<UploadProps>;
    return cloneElement(child, {
      beforeUpload: async (file, fileList) => {
        if (beforeCrop && (await beforeCrop(file, fileList)) === false)
          return Upload.LIST_IGNORE;

        const cropped = Object.assign(
          new File([cropOutput.contents ?? file], file.name, {
            lastModified: file.lastModified,
            type: file.type,
          }),
          { lastModifiedDate: new Date(file.lastModified), uid: file.uid },
        );
        const accepted = await child.props.beforeUpload?.(cropped, [cropped]);
        return accepted === true ? cropped : accepted;
      },
    });
  },
}));

type SyntheticImage = { id: string; url: string };
type UploadTestProps = ComponentProps<typeof ImageUpload<SyntheticImage>>;

const label = "Organization logo";
const previousImage = {
  id: "previous-image",
  url: "blob:synthetic-previous-image",
};
const acceptedImage = {
  id: "accepted-image",
  url: "blob:synthetic-accepted-image",
};
const onLoadingChange =
  vi.fn<NonNullable<UploadTestProps["onLoadingChange"]>>();
const onChange = vi.fn<NonNullable<UploadTestProps["onChange"]>>();
const onError = vi.fn<UploadTestProps["onError"]>();
const upload = vi.fn<UploadTestProps["upload"]>();

const renderUpload = () =>
  render(
    <ImageUpload
      label={label}
      onLoadingChange={onLoadingChange}
      onChange={onChange}
      onError={onError}
      settings={{ height: 256, size: 1_000_000, width: 256 }}
      upload={upload}
      value={previousImage}
    />,
  );

const getFileInput = (container: HTMLElement) => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Upload input is missing");
  return input;
};

const chooseFile = (container: HTMLElement, name = "image.png") => {
  const file = new File(["synthetic image bytes"], name, {
    type: "image/png",
  });
  fireEvent.change(getFileInput(container), {
    target: {
      files: [file],
    },
  });
  return file;
};

beforeEach(async () => {
  vi.resetAllMocks();
  cropOutput.contents = undefined;
  vi.mocked(readImageSize).mockResolvedValue({ height: 256, width: 256 });
  upload.mockResolvedValue(acceptedImage);
  await i18n.changeLanguage("en");
});

afterEach(cleanup);

describe("image upload request lifecycle", () => {
  it("rejects an undecodable source before cropping and permits a successful retry", async () => {
    const failure = new Error("Synthetic image decode failure");
    vi.mocked(readImageSize).mockRejectedValueOnce(failure);
    const { container } = renderUpload();

    const selected = chooseFile(container, "corrupt.png");
    await waitFor(() =>
      expect(onError).toHaveBeenCalledExactlyOnceWith(failure),
    );

    expect(readImageSize).toHaveBeenCalledTimes(1);
    expect(vi.mocked(readImageSize).mock.calls[0][0]).toBe(selected);
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
    expect(screen.getByRole("img", { name: label }).getAttribute("src")).toBe(
      previousImage.url,
    );

    const retry = chooseFile(container, "retry.png");
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith(acceptedImage),
    );

    expect(readImageSize).toHaveBeenCalledTimes(3);
    expect(vi.mocked(readImageSize).mock.calls[1][0]).toBe(retry);
    expect(vi.mocked(readImageSize).mock.calls[2][0]).not.toBe(retry);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
  });

  it.each(["success", "failure"] as const)(
    "ignores a late source decode %s after the control unmounts",
    async (outcome) => {
      const pending = deferred<Awaited<ReturnType<typeof readImageSize>>>();
      vi.mocked(readImageSize).mockReturnValueOnce(pending.promise);
      const { container, unmount } = renderUpload();
      const selected = chooseFile(container);
      await waitFor(() => expect(readImageSize).toHaveBeenCalledTimes(1));
      expect(vi.mocked(readImageSize).mock.calls[0][0]).toBe(selected);
      expect(onLoadingChange).toHaveBeenLastCalledWith(true);
      expect(getFileInput(container).disabled).toBe(true);

      unmount();
      const busyChanges = onLoadingChange.mock.calls.length;
      await act(async () => {
        if (outcome === "success") pending.resolve({ height: 256, width: 256 });
        else pending.reject(new Error("Synthetic obsolete decode failure"));
      });

      expect(readImageSize).toHaveBeenCalledTimes(1);
      expect(upload).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(onLoadingChange).toHaveBeenCalledTimes(busyChanges);
    },
  );

  it("still rejects cropped images below the required dimensions", async () => {
    vi.mocked(readImageSize)
      .mockResolvedValueOnce({ height: 512, width: 512 })
      .mockResolvedValueOnce({ height: 128, width: 256 });
    const { container } = renderUpload();

    const selected = chooseFile(container);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    expect(vi.mocked(readImageSize).mock.calls[0][0]).toBe(selected);
    expect(vi.mocked(readImageSize).mock.calls[1][0]).not.toBe(selected);
    expect(onError.mock.calls[0][0].message).toBe(i18n.t("imageTooSmall"));
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
  });

  it("still rejects cropped images that exceed the byte limit", async () => {
    cropOutput.contents = "a".repeat(1_000_001);
    const { container } = renderUpload();

    const selected = chooseFile(container);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    expect(readImageSize).toHaveBeenCalledTimes(1);
    expect(vi.mocked(readImageSize).mock.calls[0][0]).toBe(selected);
    expect(onError.mock.calls[0][0].message).toBe(i18n.t("imageTooLarge"));
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
  });

  it("retains the accepted image after an upload failure and permits a successful retry", async () => {
    const pending = deferred<SyntheticImage>();
    const failure = new Error("Synthetic upload failure");
    upload.mockReturnValueOnce(pending.promise);
    const { container } = renderUpload();

    chooseFile(container);
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(getFileInput(container).disabled).toBe(true);
    expect(screen.getByText(i18n.t("loading"))).toBeDefined();
    expect(onLoadingChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      pending.reject(failure);
    });

    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(onChange).not.toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
    expect(screen.queryByText(i18n.t("loading"))).toBeNull();
    expect(screen.getByRole("img", { name: label }).getAttribute("src")).toBe(
      previousImage.url,
    );

    chooseFile(container, "retry.png");
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith(acceptedImage),
    );
    expect(upload).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
    expect(getFileInput(container).disabled).toBe(false);
  });

  it.each(["success", "failure"] as const)(
    "ignores a late upload %s after the control unmounts",
    async (outcome) => {
      const pending = deferred<SyntheticImage>();
      upload.mockReturnValueOnce(pending.promise);
      const { container, unmount } = renderUpload();
      chooseFile(container);
      await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
      expect(onLoadingChange).toHaveBeenLastCalledWith(true);

      unmount();
      const busyChanges = onLoadingChange.mock.calls.length;
      await act(async () => {
        if (outcome === "success") pending.resolve(acceptedImage);
        else pending.reject(new Error("Synthetic obsolete upload failure"));
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(onLoadingChange).toHaveBeenCalledTimes(busyChanges);
    },
  );
});
