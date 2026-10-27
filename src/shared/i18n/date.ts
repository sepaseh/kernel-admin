import dayjs, { type Dayjs } from "dayjs";
import ar from "dayjs/locale/ar";
import de from "dayjs/locale/de";
import en from "dayjs/locale/en-gb";
import es from "dayjs/locale/es";
import fr from "dayjs/locale/fr";
import it from "dayjs/locale/it";
import pt from "dayjs/locale/pt";
import ru from "dayjs/locale/ru";
import tr from "dayjs/locale/tr";
import calendar from "dayjs/plugin/calendar";
import jalaliday from "jalaliday";

import { faDayjs } from "./dayjs/fa";
import { localeCodes } from "./locales";

dayjs.extend(calendar);
dayjs.extend(jalaliday);

const vendorLocales = { ar, de, en, es, fa: faDayjs, fr, it, pt, ru, tr };
const reference = dayjs("2026-04-01T12:00:00Z").calendar(
  "jalali",
) as unknown as Dayjs;

for (const code of localeCodes) {
  const formatter = new Intl.DateTimeFormat(code, {
    calendar: "persian",
    month: "long",
    timeZone: "UTC",
  });
  const jmonths =
    code === "fa"
      ? faDayjs.jmonths
      : Array.from({ length: 12 }, (_, month) =>
          formatter.format(reference.month(month).date(15).toDate()),
        );
  const locale = { ...vendorLocales[code], jmonths };
  dayjs.locale(locale, undefined, true);
}
