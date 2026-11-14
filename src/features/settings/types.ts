import type { FileContext, StoredFile } from "@/features/files";
import type { ThemePalettes } from "@/shared/contracts";
import type { LocaleCode } from "@/shared/i18n";

export type ImageSettings = {
  height: number;
  size: number;
  width: number;
};

export type Settings = {
  darkLogo?: StoredFile;
  darkTheme: ThemePalettes["dark"];
  imageSettings: Record<FileContext, ImageSettings>;
  language: {
    calendar: "gregory" | "jalali";
    code: LocaleCode;
    direction: "ltr" | "rtl";
    name: string;
    nativeName: string;
  };
  lightLogo?: StoredFile;
  lightTheme: ThemePalettes["light"];
};

export type SettingsRequest = Pick<
  Settings,
  "darkTheme" | "imageSettings" | "lightTheme"
> & {
  darkLogoId?: NonNullable<Settings["darkLogo"]>["id"];
  languageCode?: Settings["language"]["code"];
  lightLogoId?: NonNullable<Settings["lightLogo"]>["id"];
};

export type ApplicationLanguage = {
  calendar: "gregorian" | "gregory" | "jalali";
  code: LocaleCode;
  direction: "ltr" | "rtl";
  name: string;
  nativeName: string;
};
