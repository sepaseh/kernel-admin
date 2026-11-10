import type { PropsWithChildren } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import type { CurrentUser } from "@/features/account";
import type { DefaultLayoutContext } from "@/layouts/default";
import { sampleUser } from "./fixtures";

export const StoryShell = ({
  children,
  initialEntries = ["/faqs"],
  user = sampleUser,
}: PropsWithChildren<{ initialEntries?: string[]; user?: CurrentUser }>) => (
  <MemoryRouter initialEntries={initialEntries}>
    <Routes>
      <Route
        element={
          <Outlet
            context={
              {
                currentUser: user,
                fetchCurrentUser: async () => undefined,
                clearSession: () => undefined,
              } satisfies DefaultLayoutContext
            }
          />
        }
      >
        <Route path="*" element={children} />
      </Route>
    </Routes>
  </MemoryRouter>
);
