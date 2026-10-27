import type { MenuProps } from "antd";
import {
  Avatar,
  Breadcrumb,
  Button,
  Drawer,
  Dropdown,
  Flex,
  Grid,
  Menu,
  Spin,
  Tooltip,
} from "antd";
import { useAntdToken } from "antd-style";
import {
  FoldVertical,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Sun,
  UnfoldVertical,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

import type { NavigationItem } from "@/app/config";
import { routeTree } from "@/app/config";
import { useCore } from "@/app/hooks";
import { getAllowedNavigation } from "@/app/lib";
import { getAccount } from "@/features/account/api.ts";
import { logout } from "@/features/auth/api.ts";
import {
  AdminApiError,
  clearAccessToken,
  getAccessToken,
  getAccessTokenVersion,
  setUnauthorizedHandler,
} from "@/shared/api";
import { useReadResource } from "@/shared/hooks";
import { RequestFeedback } from "@/shared/ui/request-feedback";

const { useBreakpoint } = Grid;

export const DefaultLayout = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutPending = useRef(false);
  const mounted = useRef(false);
  const { lg } = useBreakpoint();
  const {
    compact,
    currentRoute,
    logos,
    setCompact,
    setTheme,
    setUser,
    theme: coreTheme,
    user,
  } = useCore();
  const token = useAntdToken();
  const navigate = useNavigate();
  const allowedNavigation = getAllowedNavigation(user);
  const darkMode = coreTheme === "dark";

  const createMenuItems = (
    items: readonly NavigationItem[],
  ): MenuProps["items"] =>
    items.map((item) => {
      if ("route" in item) {
        const { label, path } = routeTree[item.route];
        return {
          key: item.route,
          label: <Link to={path}>{t(label)}</Link>,
        };
      }

      return {
        children: createMenuItems(item.children),
        key: item.key,
        label: t(item.label),
      };
    });

  const menuItems = createMenuItems(allowedNavigation);

  const findBreadcrumbItems = (
    items: readonly NavigationItem[],
  ): { title: string }[] | undefined => {
    for (const item of items) {
      if ("route" in item) {
        if (item.route === currentRoute) {
          return [{ title: t(routeTree[item.route].label) }];
        }

        continue;
      }

      const children = findBreadcrumbItems(item.children);
      if (children) return [{ title: t(item.label) }, ...children];
    }
  };

  const currentRouteConfig = routeTree[currentRoute];
  const currentBreadcrumbItems =
    findBreadcrumbItems(allowedNavigation) ??
    ("label" in currentRouteConfig
      ? [{ title: t(currentRouteConfig.label) }]
      : []);
  const breadcrumbItems =
    currentRoute === "root"
      ? currentBreadcrumbItems
      : [
          {
            title: (
              <Link to={routeTree.root.path}>{t(routeTree.root.label)}</Link>
            ),
          },
          ...currentBreadcrumbItems,
        ];

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser();
    void navigate(routeTree.auth.path, { replace: true });
  }, [navigate, setUser]);

  const handleLogout = async () => {
    if (logoutPending.current) return;
    const version = getAccessTokenVersion();
    logoutPending.current = true;
    setLoggingOut(true);
    await logout().catch(() => undefined);
    if (!mounted.current) return;
    logoutPending.current = false;
    setLoggingOut(false);
    // logout() may itself clear this session. A non-null token from another
    // generation belongs to a newer login and must not be cleared here.
    if (version !== getAccessTokenVersion() && getAccessToken() !== null)
      return;
    clearSession();
  };

  const loadAccount = useCallback(
    async (signal: AbortSignal) => {
      const value = await getAccount(signal);
      if (!signal.aborted) setUser(value);
      return value;
    },
    [setUser],
  );
  const session = useReadResource(loadAccount);

  useEffect(() => {
    mounted.current = true;
    setUnauthorizedHandler(clearSession);
    return () => {
      mounted.current = false;
      setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    if (
      session.error instanceof AdminApiError &&
      [401, 403].includes(session.error.status ?? 0)
    )
      clearSession();
  }, [clearSession, session.error]);

  if (session.loading) return <Spin fullscreen />;
  if (session.error)
    return <RequestFeedback error={session.error} retry={session.reload} />;
  if (!user) return <Spin fullscreen />;

  const userName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <>
      <header style={{ backgroundColor: token.colorBgContainer }}>
        <Flex
          align="center"
          gap={16}
          justify="space-between"
          style={{
            height: 64,
            marginInline: "auto",
            maxWidth: token.screenXXXL,
            paddingInline: token.paddingSM,
          }}
        >
          <Link aria-label={t("logo")} to={routeTree.root.path}>
            {logos?.[coreTheme] ? (
              <img
                alt={t("logo")}
                src={logos[coreTheme]}
                style={{ display: "block", height: 28, width: "auto" }}
              />
            ) : null}
          </Link>
          {lg ? (
            <Menu
              builtinPlacements={{ bottomLeft: { points: ["tr", "br"] } }}
              items={menuItems}
              mode="horizontal"
              selectedKeys={[currentRoute]}
              style={{ flexGrow: 1, lineHeight: "64px" }}
            />
          ) : (
            <Flex style={{ flexGrow: 1 }}>
              <Button
                aria-label={t("menu")}
                icon={<MenuIcon aria-hidden color="currentColor" size={16} />}
                onClick={() => setOpen(true)}
                type="text"
              />
            </Flex>
          )}
          <Dropdown
            menu={{
              items: [
                {
                  icon: (
                    <UserRound aria-hidden color="currentColor" size={16} />
                  ),
                  key: "1",
                  label: t("account"),
                  onClick: () =>
                    void navigate(routeTree.account.path, { replace: true }),
                },
                {
                  icon: darkMode ? (
                    <Sun aria-hidden color="currentColor" size={16} />
                  ) : (
                    <Moon aria-hidden color="currentColor" size={16} />
                  ),
                  key: "2",
                  label: t(darkMode ? "lightMode" : "darkMode"),
                  onClick: () => setTheme(darkMode ? "light" : "dark"),
                },
                {
                  icon: compact ? (
                    <UnfoldVertical
                      aria-hidden
                      color="currentColor"
                      size={16}
                    />
                  ) : (
                    <FoldVertical aria-hidden color="currentColor" size={16} />
                  ),
                  key: "3",
                  label: t(compact ? "normalMode" : "compactMode"),
                  onClick: () => setCompact(!compact),
                },
                {
                  danger: true,
                  disabled: loggingOut,
                  icon: <LogOut aria-hidden color="currentColor" size={16} />,
                  key: "4",
                  label: t("logout"),
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <Tooltip placement="right" title={userName}>
              <Button
                aria-label={t("account")}
                icon={
                  <Avatar
                    icon={
                      <UserRound aria-hidden color="currentColor" size={16} />
                    }
                  />
                }
                loading={loggingOut}
                type="text"
              />
            </Tooltip>
          </Dropdown>
        </Flex>
      </header>
      <main
        style={{
          backgroundColor: token.colorBgLayout,
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          marginInline: "auto",
          maxWidth: token.screenXXXL,
          minWidth: 0,
          paddingBlock: token.paddingMD,
          paddingInline: token.paddingSM,
          width: "100%",
        }}
      >
        <h1
          style={{
            clip: "rect(0 0 0 0)",
            clipPath: "inset(50%)",
            height: 1,
            overflow: "hidden",
            position: "absolute",
            whiteSpace: "nowrap",
            width: 1,
          }}
        >
          {currentBreadcrumbItems.at(-1)?.title}
        </h1>
        <Breadcrumb
          aria-label={t("breadcrumb")}
          items={breadcrumbItems}
          style={{ marginBottom: token.marginMD }}
        />
        <Outlet />
      </main>
      <Drawer
        closeIcon={false}
        onClose={() => setOpen(false)}
        open={!lg && open}
        styles={{ body: { padding: 8 } }}
        title={false}
      >
        <nav aria-label={t("menu")}>
          <Menu
            items={menuItems}
            mode="inline"
            onClick={() => setOpen(false)}
            selectedKeys={[currentRoute]}
          />
        </nav>
      </Drawer>
    </>
  );
};
