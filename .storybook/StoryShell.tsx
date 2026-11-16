import type { PropsWithChildren } from "react";
import { useContext, useEffect, useRef, useState } from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  Outlet,
  Route,
  type RouteObject,
  Routes,
} from "react-router";
import { RouterProvider } from "react-router/dom";

import { CoreContext } from "@/app/contexts";
import type { CurrentUser } from "@/features/account";
import { fetchCurrentUser } from "@/features/account/api";
import type { Settings } from "@/features/settings/types";
import type { DefaultLayoutContext } from "@/layouts/default";
import type { Theme } from "@/shared/contracts";

import { sampleAccount, sampleLanguages } from "./fixtures";
import { PreviewFrame } from "./PreviewFrame";

type StoryShellProps = PropsWithChildren<{
  initialEntries?: string[];
  initialLanguage?: Settings["language"];
  initialTheme?: Theme;
  initialUser?: CurrentUser;
  routes?: RouteObject[];
  withUser?: boolean;
}>;

export const StoryShell = ({
  children,
  initialEntries = ["/"],
  initialLanguage = sampleLanguages.en,
  initialTheme = "light",
  initialUser = sampleAccount,
  routes,
  withUser = true,
}: StoryShellProps) => {
  const core = useContext(CoreContext);
  const sessionGeneration = useRef(0);
  const [user, setUser] = useState<CurrentUser | undefined>(
    withUser ? initialUser : undefined,
  );
  const [router] = useState(() =>
    routes ? createMemoryRouter(routes, { initialEntries }) : undefined,
  );

  useEffect(() => () => router?.dispose(), [router]);

  const content = router ? (
    <RouterProvider router={router} />
  ) : (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          element={
            <Outlet
              context={
                user
                  ? ({
                      currentUser: user,
                      fetchCurrentUser: async () => {
                        const generation = sessionGeneration.current;
                        const currentUser = await fetchCurrentUser();
                        if (generation === sessionGeneration.current)
                          setUser(currentUser);
                      },
                      clearSession: () => {
                        sessionGeneration.current += 1;
                        setUser(undefined);
                      },
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
    content
  ) : (
    <PreviewFrame
      initialLanguage={initialLanguage}
      languageCode={initialLanguage.code === "fa" ? "fa" : "en"}
      themeMode={initialTheme}
    >
      {content}
    </PreviewFrame>
  );
};
