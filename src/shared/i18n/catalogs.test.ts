import dayjs, { type Dayjs } from "dayjs";
import { afterEach, describe, expect, it } from "vitest";

import { catalogs } from "./catalogs";
import { dayjsLocaleName } from "./date";
import { faDayjs } from "./dayjs/fa";
import { localeCodes } from "./locales";

afterEach(() => {
  dayjs.calendar("gregory");
  dayjs.locale("en");
});

describe("language and calendar data", () => {
  it("retains the ten supported catalogs with a nonempty value for every English key", () => {
    expect(localeCodes).toEqual([
      "ar",
      "de",
      "en",
      "es",
      "fa",
      "fr",
      "it",
      "pt",
      "ru",
      "tr",
    ]);
    const keys = Object.keys(catalogs.en).sort();

    for (const code of localeCodes) {
      expect(Object.keys(catalogs[code]).sort(), code).toEqual(keys);
      expect(
        Object.values(catalogs[code]).every(
          (value) => typeof value === "string" && value.trim().length > 0,
        ),
        code,
      ).toBe(true);
    }
  });

  it("formats a known Nowruz date with Persian month data", () => {
    const nowruz = (
      dayjs("2026-03-21T12:00:00Z").calendar("jalali") as unknown as Dayjs
    ).locale("fa");

    expect(nowruz.format("YYYY-MM-DD")).toBe("1405-01-01");
    expect(nowruz.format("MMMM")).toBe("فروردین");
    expect(faDayjs.jmonths).toHaveLength(12);
    expect(faDayjs.jmonths[11]).toBe("اسفند");
    expect(faDayjs.weekStart).toBe(6);
  });

  it("registers a usable date locale for each UI language", () => {
    for (const code of localeCodes) {
      const date = (
        dayjs("2026-04-01T12:00:00Z").calendar("jalali") as unknown as Dayjs
      ).locale(dayjsLocaleName(code));

      expect(date.locale()).toBe(dayjsLocaleName(code));
      expect(date.format("MMMM"), code).not.toMatch(/undefined|Invalid/);
      expect(date.format("YYYY-MM-DD"), code).toBe("1405-01-12");
    }
  });
});
