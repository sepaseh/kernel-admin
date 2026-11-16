import {
  type AccessRule,
  type NavigationItem,
  type RouteKey,
  navigationTree,
  routeTree,
} from "@/app/config";
import type { CurrentUser } from "@/features/account";
import type { PermissionKey } from "@/features/roles";

const hasAccess = (access: AccessRule, user?: CurrentUser): boolean => {
  if (access === "public") return true;
  if (!user) return false;
  if (access === "authenticated" || user.isSystemAdmin) return true;

  return user.permissions.includes(access);
};

export const hasRouteAccess = (route: RouteKey, user?: CurrentUser): boolean =>
  hasAccess(routeTree[route].permissions.access, user);

const filterNavigation = (
  items: readonly NavigationItem[],
  user?: CurrentUser,
): NavigationItem[] =>
  items.flatMap<NavigationItem>((item): NavigationItem[] => {
    if ("route" in item) {
      return hasRouteAccess(item.route, user) ? [item] : [];
    }

    const children = filterNavigation(item.children, user);
    return children.length ? [{ ...item, children }] : [];
  });

export const getAllowedNavigation = (user?: CurrentUser): NavigationItem[] =>
  filterNavigation(navigationTree, user);

const hasPermission = (
  permission: PermissionKey,
  user?: CurrentUser,
): boolean =>
  Boolean(user?.isSystemAdmin || user?.permissions.includes(permission));

type RouteActionPermissions<Key extends RouteKey> = {
  [Action in keyof (typeof routeTree)[Key]["permissions"]["actions"]]: boolean;
};

export const getRoutePermissions = <Key extends RouteKey>(
  route: Key,
  user?: CurrentUser,
): RouteActionPermissions<Key> => {
  const actions: Record<string, PermissionKey> =
    routeTree[route].permissions.actions;
  return Object.fromEntries(
    Object.entries(actions).map(([action, permission]) => [
      action,
      hasPermission(permission, user),
    ]),
  ) as RouteActionPermissions<Key>;
};
