import {
  type ComponentType,
  type PropsWithChildren,
  Fragment,
  lazy,
  Suspense,
  useEffect,
} from "react";
import {
  type RouteObject,
  createBrowserRouter,
  Navigate,
  useOutletContext,
  useRouteError,
} from "react-router";
import { RouterProvider } from "react-router/dom";

import {
  type RouteKey,
  type RouteLayout,
  baseUrl,
  routeTree,
} from "@/app/config";
import { useCore } from "@/app/hooks";
import { hasRouteAccess } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { reportError } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui/error-boundary";
import { RouteLoading } from "@/shared/ui/route-loading";

const pageRegistry = {
  account: async () => (await import("@/features/account")).AccountPage,
  auth: async () => (await import("@/features/login")).LoginPage,
  calendar: async () => (await import("@/features/calendar")).CalendarPage,
  forgotPassword: async () =>
    (await import("@/features/forgot-pass")).ForgotPassPage,
  notFound: async () => (await import("@/features/not-found")).NotFoundPage,
  register: async () => (await import("@/features/register")).RegisterPage,
  roles: async () => (await import("@/features/roles")).RolesPage,
  root: async () => (await import("@/features/dashboard")).DashboardPage,
  settings: async () => (await import("@/features/settings")).SettingsPage,
  files: async () => (await import("@/features/files")).FilesPage,
  users: async () => (await import("@/features/users")).UsersPage,
} satisfies Record<RouteKey, () => Promise<ComponentType>>;

type RouteAccessProps = PropsWithChildren<{
  route: RouteKey;
}>;

const RouteWrapper = ({ route, children }: RouteAccessProps) => {
  const { setCurrentRoute } = useCore();

  useEffect(() => {
    setCurrentRoute(route);
  }, [route, setCurrentRoute]);

  return <Fragment>{children}</Fragment>;
};

const ProtectedRoute = ({ route, children }: RouteAccessProps) => {
  const { currentUser } = useOutletContext<DefaultLayoutContext>();

  if (hasRouteAccess(route, currentUser))
    return <Fragment>{children}</Fragment>;

  return <Navigate replace to={routeTree.root.path} />;
};

const routeKeys = Object.keys(routeTree) as RouteKey[];

const createPageRoute = (route: RouteKey): RouteObject => {
  const definition = routeTree[route];
  if (definition.permissions.access !== "public") {
    const Page = lazy(async () => ({
      default: await pageRegistry[route](),
    }));
    const element = (
      <RouteWrapper route={route}>
        <ProtectedRoute route={route}>
          <Suspense fallback={<RouteLoading />}>
            <Page />
          </Suspense>
        </ProtectedRoute>
      </RouteWrapper>
    );
    return "index" in definition && definition.index
      ? { index: true, element }
      : { path: definition.path, element };
  }

  const loadPage = async () => {
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
    ? { index: true, lazy: loadPage }
    : { path: definition.path, lazy: loadPage };
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
