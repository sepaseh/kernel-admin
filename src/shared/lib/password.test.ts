import { afterEach, describe, expect, it, vi } from "vitest";

import { generatePassword } from "./password";

afterEach(() => vi.restoreAllMocks());

describe("generated passwords", () => {
  it("uses sixteen cryptographically random bytes, including zero-valued bytes", () => {
    const random = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation((values) => {
        if (values instanceof Uint8Array) values.set([4, 15, 35, 35, 35, 33]);
        return values;
      });

    expect(generatePassword()).toBe("4fzzzx0000000000");
    expect(random).toHaveBeenCalledOnce();
    expect(random.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(random.mock.calls[0][0]?.byteLength).toBe(16);
  });
});
