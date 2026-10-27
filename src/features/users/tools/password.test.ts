import { afterEach, describe, expect, it, vi } from "vitest";

import { generatePassword } from "./password";

afterEach(() => vi.restoreAllMocks());

describe("generatePassword", () => {
  it("creates a sixteen-character base-36 password", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((values) => {
      new Uint8Array(values.buffer).set([4, 15, 35, 35, 35, 33]);

      return values;
    });

    expect(generatePassword()).toBe("4fzzzx0000000000");
  });

  it("keeps zero-valued bytes in the password", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((values) => {
      new Uint8Array(values.buffer).set([18, 0, 0, 0, 0, 0]);

      return values;
    });

    expect(generatePassword()).toBe("i000000000000000");
  });
});
