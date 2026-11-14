import dayjs, { type Dayjs } from "dayjs";
import { expect, it } from "vitest";

import { dayjsLocaleName } from "./date";
import { localeCodes } from "./locales";

it.each(localeCodes)("formats both API calendars in the %s locale", (code) => {
  const date = dayjs("2026-09-01T12:00:00Z").locale(dayjsLocaleName(code));
  const gregorian = date.calendar("gregory") as unknown as Dayjs;
  const jalali = date.calendar("jalali") as unknown as Dayjs;

  expect(date.locale()).toBe(dayjsLocaleName(code));
  expect(gregorian.year()).toBe(2026);
  expect(jalali.year()).toBe(1405);
  expect(jalali.format("MMMM")).not.toBe(gregorian.format("MMMM"));
  expect(
    new Set(
      Array.from({ length: 12 }, (_, month) =>
        jalali.month(month).format("MMMM"),
      ),
    ).size,
  ).toBe(12);
});

it("keeps Persian Gregorian and Jalali month names distinct", () => {
  const date = dayjs("2026-09-01T12:00:00Z").locale("fa");
  expect((date.calendar("gregory") as unknown as Dayjs).format("MMMM")).toBe(
    "سپتامبر",
  );
  expect((date.calendar("jalali") as unknown as Dayjs).format("MMMM")).toBe(
    "شهریور",
  );
});
