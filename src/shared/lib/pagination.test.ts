import { describe, expect, it } from "vitest";

import { getPage } from "./pagination";

describe("getPage", () => {
  it.each([
    ["1", 1],
    ["24", 24],
    [" 007 ", 7],
  ])("reads %j as page %i", (value, page) => {
    expect(getPage(value)).toBe(page);
  });

  it.each([undefined, "", " ", "invalid", "0", "-2"])(
    "falls back to page one for %j",
    (value) => {
      expect(getPage(value)).toBe(1);
    },
  );

  it.each([
    ["3.5", 3],
    ["4suffix", 4],
  ])("reads the decimal integer prefix of %j as page %i", (value, page) => {
    expect(getPage(value)).toBe(page);
  });
});
