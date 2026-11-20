import { describe, expect, it } from "vitest";

import { reorderRows } from "./reorder-rows";

const first = { id: "first", name: "First record" };
const second = { id: "2", name: "Second record" };
const third = { id: "third", name: "Third record" };

describe("reorderRows", () => {
  it("moves a row down without changing the source or row objects", () => {
    const rows = [first, second, third];

    const reordered = reorderRows(rows, first.id, third.id);

    expect(reordered).toEqual([second, third, first]);
    expect(reordered?.[2]).toBe(first);
    expect(rows).toEqual([first, second, third]);
  });

  it("moves a row up to the target position", () => {
    expect(reorderRows([first, second, third], third.id, first.id)).toEqual([
      third,
      first,
      second,
    ]);
  });

  it.each([
    [first.id, undefined],
    [first.id, first.id],
    ["missing", first.id],
    [first.id, "missing"],
    [first.id, 2],
  ])(
    "ignores a drag from %s to %s without a different row pair",
    (active, over) => {
      expect(reorderRows([first, second, third], active, over)).toBeUndefined();
    },
  );

  it("ignores an empty table", () => {
    expect(reorderRows([], first.id, third.id)).toBeUndefined();
  });
});
