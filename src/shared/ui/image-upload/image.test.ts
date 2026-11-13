// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readImageSize } from "./image";

let image: HTMLImageElement;
const createObjectURL = vi.fn(() => "blob:synthetic-image");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  image = document.createElement("img");
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal(
    "Image",
    vi.fn(function () {
      return image;
    }),
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("image dimension validation", () => {
  it("reads the decoded image dimensions and releases its temporary URL", async () => {
    const file = new File(["synthetic image bytes"], "image.png", {
      type: "image/png",
    });
    Object.defineProperties(image, {
      naturalWidth: { value: 1200 },
      naturalHeight: { value: 630 },
    });
    const dimensions = readImageSize(file);
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(image.src).toBe("blob:synthetic-image");
    expect(revokeObjectURL).not.toHaveBeenCalled();

    image.dispatchEvent(new Event("load"));

    await expect(dimensions).resolves.toEqual({ width: 1200, height: 630 });
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:synthetic-image",
    );
  });

  it("rejects undecodable image data and still releases its temporary URL", async () => {
    const dimensions = readImageSize(
      new File(["invalid synthetic image"], "invalid.png"),
    );
    const rejected = expect(dimensions).rejects.toThrow("Invalid image");
    image.dispatchEvent(new Event("error"));
    await rejected;
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:synthetic-image",
    );
  });
});
