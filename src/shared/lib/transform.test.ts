import { describe, expect, expectTypeOf, it } from "vitest";

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

  it("requires output validation after renaming keys and omitting null fields", () => {
    const camel = toCamelCase({ first_name: "Ada", deleted_at: null });
    const snake = toSnakeCase({ firstName: "Ada", deletedAt: null });
    const collection = toCamelCase([{ role_id: "role-1" }, null]);

    expectTypeOf(camel).toBeUnknown();
    expectTypeOf(snake).toBeUnknown();
    expectTypeOf(collection).toBeUnknown();
    // @ts-expect-error Renamed input keys are not a validated output contract.
    expect(camel.first_name).toBeUndefined();
    // @ts-expect-error Null fields are omitted from transformed objects.
    expect(camel.deleted_at).toBeUndefined();
    // @ts-expect-error The input type cannot describe renamed output keys.
    expect(snake.firstName).toBeUndefined();
    // @ts-expect-error Array members also require output validation.
    expect(collection[0].role_id).toBeUndefined();
    expect(collection).toEqual([{ roleId: "role-1" }, null]);
  });

  it("preserves prototype-looking JSON keys as own data without changing result prototypes", () => {
    const input: Record<string, unknown> = JSON.parse(
      '{"__proto__":{"isAdmin":true},"safeKey":1,"nestedValue":{"__proto__":{"nestedAdmin":true},"omittedValue":null}}',
    );

    const result = toSnakeCase(input);
    if (
      result === null ||
      typeof result !== "object" ||
      !("nested_value" in result)
    ) {
      throw new Error("Expected a transformed object with nested data");
    }
    const nested = result.nested_value;
    if (nested === null || typeof nested !== "object") {
      throw new Error("Expected transformed nested data");
    }

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(Object.hasOwn(nested, "__proto__")).toBe(true);
    expect("is_admin" in result).toBe(false);
    expect("nested_admin" in nested).toBe(false);
    expect(JSON.stringify(result)).toBe(
      '{"__proto__":{"is_admin":true},"safe_key":1,"nested_value":{"__proto__":{"nested_admin":true}}}',
    );
  });

  it.each([
    new Date("2026-01-01T00:00:00.000Z"),
    new FormData(),
    new Blob(["value"]),
  ])("leaves non-plain built-in values unchanged", (value) => {
    const camel = toCamelCase(value);
    const snake = toSnakeCase(value);

    expectTypeOf(camel).toBeUnknown();
    expectTypeOf(snake).toBeUnknown();
    expect(camel).toBe(value);
    expect(snake).toBe(value);
    if (camel instanceof Date && value instanceof Date) {
      expectTypeOf(camel).toEqualTypeOf<Date>();
      expect(camel.getTime()).toBe(value.getTime());
    }
  });

  it("leaves class instances unchanged", () => {
    class Value {
      snake_key = "value";
      removed_field = null;
    }

    const value = new Value();
    const result = toCamelCase(value);

    expectTypeOf(result).toBeUnknown();
    expect(result).toBe(value);
    if (!(result instanceof Value)) {
      throw new Error("Expected the original class instance");
    }
    expectTypeOf(result).toEqualTypeOf<Value>();
    expect(result.snake_key).toBe("value");
    expect(result.removed_field).toBeNull();
    expect(toSnakeCase(value)).toBe(value);
  });
});
