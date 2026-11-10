import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Flex,
  Layout,
  Spin,
  Tooltip,
} from "antd";
import { useResponsive } from "antd-style";
import {
  FoldVertical,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Sun,
  UnfoldVertical,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

import { routeTree } from "@/app/config";
import { useAntd, useCore } from "@/app/hooks";
import { getAllowedNavigation } from "@/app/lib";
import {
  type CurrentUser,
  fetchCurrentUser as fetchCurrentUserRequest,
} from "@/features/account";
import { isCancel } from "axios";
import { logout } from "@/features/auth";
import { clearAccessToken, setUnauthorizedHandler } from "@/shared/api";

import { useAbortController, useLock } from "@/shared/hooks";
import { RequestError } from "@/shared/ui/request-error";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Navigation } from "./components/navigation";
import type { DefaultLayoutContext } from "./types";

export const DefaultLayout = () => {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<CurrentUser>();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI, token } = useAntd();
  const { compact, currentRoute, settings, setCompact, setTheme, theme } =
    useCore();
  const { lock, unlock } = useLock();
  const navigate = useNavigate();
  const { lg } = useResponsive();
  const allowedNavigation = getAllowedNavigation(currentUser);
  const darkMode = theme === "dark";
  const logo = settings[`${theme}Logo`]?.url;

  const fetchCurrentUser = useCallback(async () => {
    const signal = start();
    setLoading(true);

    try {
      const data = await fetchCurrentUserRequest(signal);
      if (signal.aborted) return;

      setCurrentUser(data);
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [messageAPI, start]);

  const clearSession = useCallback(() => {
    clearAccessToken();
    cancel();
    setCurrentUser(undefined);
    setLoading(false);
    void navigate(routeTree.auth.path, { replace: true });
  }, [cancel, navigate]);

  const handleLogout = async () => {
    if (!lock()) return;

    setLoggingOut(true);

    try {
      await logout();

      clearSession();
    } catch (error) {
      if (error instanceof Error) void messageAPI.error(error.message);
      clearSession();
    } finally {
      unlock();
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    void (async () => {
      await fetchCurrentUser();
    })();

    return cancel;
  }, [cancel, fetchCurrentUser]);

  if (loggingOut || (!currentUser && loading))
    return (
      <Spin
        aria-label={t("loading")}
        fullscreen
        ref={(node) => node?.nativeElement.setAttribute("role", "status")}
      />
    );

  if (!currentUser)
    return (
      <RequestError
        error={new Error(t("currentUserLoadFailed"))}
        onRetry={fetchCurrentUser}
      />
    );

  return (
    <Layout style={{ minHeight: "100dvh" }}>
      <Layout.Header>
        <Flex
          align="center"
          gap={token.size}
          justify="space-between"
          style={{
            height: 64,
            marginInline: "auto",
            maxWidth: token.screenXXXL,
            paddingInline: token.paddingSM,
          }}
        >
          <Link aria-label={t("logo")} to={routeTree.root.path}>
            {logo ? (
              <img
                alt={t("logo")}
                src={logo}
                style={{ display: "block", height: 28, width: "auto" }}
              />
            ) : null}
          </Link>
          {lg ? (
            <Navigation
              builtinPlacements={{
                bottomLeft: {
                  points:
                    settings.language.direction === "rtl"
                      ? ["tr", "br"]
                      : ["tl", "bl"],
                },
                bottomRight: {
                  points:
                    settings.language.direction === "rtl"
                      ? ["tr", "br"]
                      : ["tl", "bl"],
                },
              }}
              currentRoute={currentRoute}
              items={allowedNavigation}
              mode="horizontal"
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
                  onClick: () => void navigate(routeTree.account.path),
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
            <Tooltip
              placement="right"
              title={`${currentUser.firstName} ${currentUser.lastName}`.trim()}
            >
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
      </Layout.Header>
      <Layout.Content
        style={{
          marginInline: "auto",
          maxWidth: token.screenXXXL,
          minWidth: 0,
          paddingBlock: token.paddingMD,
          paddingInline: token.paddingSM,
          width: "100%",
        }}
      >
        <Breadcrumbs currentRoute={currentRoute} items={allowedNavigation} />
        <Outlet
          context={
            {
              currentUser,
              fetchCurrentUser,
              clearSession,
            } satisfies DefaultLayoutContext
          }
        />
      </Layout.Content>
      <Drawer
        closeIcon={false}
        onClose={() => setOpen(false)}
        open={!lg && open}
        styles={{ body: { padding: token.paddingXS } }}
        title={false}
      >
        <nav aria-label={t("menu")}>
          <Navigation
            currentRoute={currentRoute}
            items={allowedNavigation}
            mode="inline"
            onClick={() => setOpen(false)}
          />
        </nav>
      </Drawer>
    </Layout>
  );
};
