import { describe, expect, it } from "vitest";

import { toCamelCase, toSnakeCase } from "./transform";

describe("case transforms", () => {
  it("converts nested API responses to camel case", () => {
    const callback = () => undefined;

    expect(
      toCamelCase({
        "display-name": "Ada",
        first_name: "Ada",
        onComplete: callback,
        role_ids: ["role-1"],
        profile: { created_at: 1, deleted_at: null },
        username: null,
      }),
    ).toEqual({
      displayName: "Ada",
      firstName: "Ada",
      onComplete: callback,
      roleIds: ["role-1"],
      profile: { createdAt: 1 },
    });
  });

  it("converts nested request bodies to snake case", () => {
    expect(
      toSnakeCase({
        firstName: "Ada",
        middleName: null,
        roles: [{ roleId: "role-1" }],
        profile: { createdAt: 1 },
      }),
    ).toEqual({
      first_name: "Ada",
      roles: [{ role_id: "role-1" }],
      profile: { created_at: 1 },
    });
  });

  it("preserves prototype-looking JSON keys as own data without changing result prototypes", () => {
    const input: Record<string, unknown> = JSON.parse(
      '{"__proto__":{"isAdmin":true},"safeKey":1,"nestedValue":{"__proto__":{"nestedAdmin":true},"omittedValue":null}}',
    );

    const result = toSnakeCase(input);
    const nested = result.nested_value as Record<string, unknown>;

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(Object.hasOwn(nested, "__proto__")).toBe(true);
    expect(result.is_admin).toBeUndefined();
    expect(nested.nested_admin).toBeUndefined();
    expect(JSON.stringify(result)).toBe(
      '{"__proto__":{"is_admin":true},"safe_key":1,"nested_value":{"__proto__":{"nested_admin":true}}}',
    );
  });

  it.each([
    new Date("2026-01-01T00:00:00.000Z"),
    new FormData(),
    new Blob(["value"]),
  ])("leaves non-plain built-in values unchanged", (value) => {
    expect(toCamelCase(value)).toBe(value);
    expect(toSnakeCase(value)).toBe(value);
  });

  it("leaves class instances unchanged", () => {
    class Value {
      snake_key = "value";
    }

    const value = new Value();

    expect(toCamelCase(value)).toBe(value);
    expect(toSnakeCase(value)).toBe(value);
  });
});
