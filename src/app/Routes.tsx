import type { ComponentType, FC, ReactNode } from "react";
import { Fragment, useEffect } from "react";
import type { RouteObject } from "react-router";
import { createBrowserRouter, Navigate, useRouteError } from "react-router";
import { RouterProvider } from "react-router/dom";

import type { RouteKey, RouteLayout } from "@/app/config";
import { baseUrl, routeTree } from "@/app/config";
import { useCore } from "@/app/hooks";
import { hasRouteAccess } from "@/app/lib";
import { reportError } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";
import { RouteLoading } from "@/shared/ui/route-loading";

const pageRegistry = {
  account: async () => (await import("@/features/account")).AccountPage,
  auth: async () => (await import("@/features/login")).LoginPage,
  calendar: async () => (await import("@/features/calendar")).CalendarPage,
  forgotPassword: async () =>
    (await import("@/features/forgot-pass")).ForgotPassPage,
  notFound: async () => (await import("@/app/not-found/NotFound")).NotFoundPage,
  register: async () => (await import("@/features/register")).RegisterPage,
  roles: async () => (await import("@/features/roles")).RolesPage,
  root: async () => (await import("@/features/dashboard")).DashboardPage,
  settings: async () => (await import("@/features/settings")).SettingsPage,
  users: async () => (await import("@/features/users")).UsersPage,
} satisfies Record<RouteKey, () => Promise<ComponentType>>;

type RouteWrapperProps = {
  children: ReactNode;
  route: RouteKey;
};

const RouteWrapper: FC<RouteWrapperProps> = ({ route, children }) => {
  const { setCurrentRoute, user } = useCore();

  useEffect(() => {
    setCurrentRoute(route);
  }, [route, setCurrentRoute]);

  if (hasRouteAccess(route, user)) return <Fragment>{children}</Fragment>;

  return <Navigate to={routeTree.root.path} replace />;
};

const routeKeys = Object.keys(routeTree) as RouteKey[];

const createPageRoute = (route: RouteKey): RouteObject => {
  const definition = routeTree[route];
  const lazy = async () => {
    const Page = await pageRegistry[route]();
    return {
      element: (
        <RouteWrapper route={route}>
          <Page />
        </RouteWrapper>
      ),
    };
  };
  return "index" in definition && definition.index
    ? { index: true, lazy }
    : { path: definition.path, lazy };
};

const createLayoutRoutes = (layout: RouteLayout): RouteObject[] =>
  routeKeys
    .filter((route) => routeTree[route].layout === layout)
    .map(createPageRoute);

const RouteErrorBoundary = () => {
  const error = useRouteError();

  useEffect(() => {
    reportError(error, { source: "react-router.error-boundary" });
  }, [error]);

  return <ErrorFallback />;
};

const router = createBrowserRouter(
  [
    {
      children: [
        {
          path: routeTree.auth.path,
          lazy: async () => ({
            Component: (await import("@/layouts/auth")).AuthLayout,
          }),
          children: createLayoutRoutes("auth"),
        },
        {
          path: routeTree.root.path,
          lazy: async () => ({
            Component: (await import("@/layouts/default")).DefaultLayout,
          }),
          children: createLayoutRoutes("default"),
        },
        ...createLayoutRoutes("standalone"),
      ],
      errorElement: <RouteErrorBoundary />,
      HydrateFallback: RouteLoading,
    },
  ],
  { basename: baseUrl },
);

export const Routes = () => <RouterProvider router={router} />;
