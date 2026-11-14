import { describe, expect, it } from "vitest";

import { encodeIdPathSegment } from "./path";

describe("resource ID path segments", () => {
  it.each(["", ".", ".."])("rejects the unsafe segment %j", (id) => {
    expect(() => encodeIdPathSegment(id)).toThrow(TypeError);
  });

  it.each([
    ["user-1", "user-1"],
    ["member.profile", "member.profile"],
    ["...", "..."],
    [" .", "%20."],
    ["%2e", "%252e"],
    ["member/#? 1", "member%2F%23%3F%201"],
    ["عضو آبی", "%D8%B9%D8%B6%D9%88%20%D8%A2%D8%A8%DB%8C"],
    ["encoded%2Fid", "encoded%252Fid"],
  ])("keeps opaque ID %j inside one URL segment", (id, encoded) => {
    expect(encodeIdPathSegment(id)).toBe(encoded);
    expect(
      new URL(`https://api.example.test/users/${encodeIdPathSegment(id)}`)
        .pathname,
    ).toBe(`/users/${encoded}`);
  });
});
