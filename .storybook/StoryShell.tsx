import type { ReactNode } from "react";
import { useContext, useState } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";

import { CoreContext } from "@/app/contexts";
import type { CurrentUser } from "@/features/account";
import { fetchCurrentUser } from "@/features/account/api";
import type { ApplicationLanguage } from "@/features/settings/types";
import type { DefaultLayoutContext } from "@/layouts/default";
import type { Theme } from "@/shared/contracts";

import { sampleAccount, sampleLanguages } from "./fixtures";
import { PreviewFrame } from "./PreviewFrame";

type StoryShellProps = {
  children: ReactNode;
  initialEntries?: string[];
  initialLanguage?: ApplicationLanguage;
  initialTheme?: Theme;
  initialUser?: CurrentUser;
  withUser?: boolean;
};

export const StoryShell = ({
  children,
  initialEntries = ["/"],
  initialLanguage = sampleLanguages.en,
  initialTheme = "light",
  initialUser = sampleAccount,
  withUser = true,
}: StoryShellProps) => {
  const core = useContext(CoreContext);
  const [user, setUser] = useState<CurrentUser | undefined>(
    withUser ? initialUser : undefined,
  );
  const router = (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          element={
            <Outlet
              context={
                user
                  ? ({
                      currentUser: user,
                      fetchCurrentUser: async () =>
                        setUser(await fetchCurrentUser()),
                      clearSession: () => setUser(undefined),
                    } satisfies DefaultLayoutContext)
                  : undefined
              }
            />
          }
        >
          <Route
            path="*"
            element={withUser && !user ? <p>Session cleared</p> : children}
          />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  return core ? (
    router
  ) : (
    <PreviewFrame
      initialLanguage={initialLanguage}
      languageCode={initialLanguage.code === "fa" ? "fa" : "en"}
      themeMode={initialTheme}
    >
      {router}
    </PreviewFrame>
  );
};
