import "./date";

import dayjs, { type Dayjs } from "dayjs";
import { expect, it } from "vitest";

import { localeCodes } from "./locales";

it.each(localeCodes)(
  "formats both server calendars with the real %s vendor locale",
  (code) => {
    const date = dayjs("2026-09-01T12:00:00Z").locale(
      code === "en" ? "en-gb" : code,
    );
    expect(date.locale()).toBe(code === "en" ? "en-gb" : code);
    const gregorian = date.calendar("gregory") as unknown as Dayjs;
    const jalali = date.calendar("jalali") as unknown as Dayjs;
    expect(gregorian.year()).toBe(2026);
    expect(jalali.year()).toBe(1405);
    expect(gregorian.format("MMMM")).toBeTruthy();
    expect(jalali.format("MMMM")).toBeTruthy();
    expect(jalali.format("MMMM")).not.toBe(gregorian.format("MMMM"));
    expect(
      new Set(
        Array.from({ length: 12 }, (_, month) =>
          jalali.month(month).format("MMMM"),
        ),
      ).size,
    ).toBe(12);
  },
);

it("keeps Persian Gregorian and Jalali month names distinct", () => {
  const date = dayjs("2026-09-01T12:00:00Z").locale("fa");
  expect((date.calendar("gregory") as unknown as Dayjs).format("MMMM")).toBe(
    "سپتامبر",
  );
  expect((date.calendar("jalali") as unknown as Dayjs).format("MMMM")).toBe(
    "شهریور",
  );
});
