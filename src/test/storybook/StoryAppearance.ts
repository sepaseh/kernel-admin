import { createContext } from "react";

import type { ApplicationLanguage } from "@/features/settings/types";
import type { Theme } from "@/shared/contracts/appearance";

export type StoryAppearance = {
  language: ApplicationLanguage;
  theme: Theme;
};

export const StoryAppearanceContext = createContext<
  StoryAppearance | undefined
>(undefined);
