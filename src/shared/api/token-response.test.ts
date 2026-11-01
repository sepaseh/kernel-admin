import { describe, expect, it } from "vitest";

import { i18nInstance } from "../i18n/index.ts";
import { parseAccessToken } from "./token-response.ts";

describe("token response boundary", () => {
  it.each([
    null,
    undefined,
    [],
    "token",
    42,
    {},
    { accessToken: 42 },
    { accessToken: "" },
    { accessToken: "   " },
  ])("rejects a malformed reply without exposing its contents: %j", (value) => {
    expect(() => parseAccessToken(value)).toThrow(
      i18nInstance.t("unexpectedError"),
    );
  });

  it("accepts an opaque token and returns only the documented contract", () => {
    expect(
      parseAccessToken({
        accessToken: "opaque-test-token",
        privateField: "ignored",
      }),
    ).toEqual({ accessToken: "opaque-test-token" });
  });
});
