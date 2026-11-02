import { describe, expect, it } from "vitest";

import { i18nInstance } from "../i18n/index.ts";
import { encodeIdPathSegment } from "./path.ts";

describe("resource ID path segments", () => {
  it.each([".", ".."])("rejects the URL dot segment %j", (id) => {
    expect(() => encodeIdPathSegment(id)).toThrow(
      i18nInstance.t("unexpectedError"),
    );
  });

  it.each([
    ["user-1", "user-1"],
    ["member.profile", "member.profile"],
    ["...", "..."],
    [" .", "%20."],
    [".. ", "..%20"],
    ["%2e", "%252e"],
    ["%2E%2e", "%252E%252e"],
    ["member/#? 1", "member%2F%23%3F%201"],
    ["عضو آبی", "%D8%B9%D8%B6%D9%88%20%D8%A2%D8%A8%DB%8C"],
    ["encoded%2Fid", "encoded%252Fid"],
  ])("preserves the opaque ID %j as one URL segment", (id, segment) => {
    const encoded = encodeIdPathSegment(id);

    expect(encoded).toBe(segment);
    expect(new URL(`http://localhost/users/${encoded}`).pathname).toBe(
      `/users/${segment}`,
    );
  });
});
