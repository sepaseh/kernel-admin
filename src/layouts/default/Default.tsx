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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import {
  AdminApiError,
  clearAccessToken,
  getAccessToken,
  getAccessTokenVersion,
  setUnauthorizedHandler,
} from "@/shared/api";

import { useAbortController, useLock } from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { RequestError } from "@/shared/ui/request-error";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Navigation } from "./components/navigation";
import type { DefaultLayoutContext } from "./types";

export const DefaultLayout = () => {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<CurrentUser>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(false);
  const { cancel, start } = useAbortController();
  const { messageAPI, token } = useAntd();
  const { compact, currentRoute, settings, setCompact, setTheme, theme } =
    useCore();
  const { lock, unlock } = useLock();
  const mounted = useRef(false);
  const navigate = useNavigate();
  const { lg } = useResponsive();
  const allowedNavigation = getAllowedNavigation(currentUser);
  const darkMode = theme === "dark";
  const logo = settings[`${theme}Logo`]?.url;

  const clearSession = useCallback(() => {
    clearAccessToken();
    cancel();
    setCurrentUser(undefined);
    setError(undefined);
    setLoading(false);
    void navigate(routeTree.auth.path, { replace: true });
  }, [cancel, navigate]);

  const fetchCurrentUser = useCallback(async () => {
    if (!mounted.current) return;

    const signal = start();
    const version = getAccessTokenVersion();
    setLoading(true);

    try {
      const data = await fetchCurrentUserRequest(signal);
      if (
        !mounted.current ||
        signal.aborted ||
        version !== getAccessTokenVersion()
      )
        return;

      setCurrentUser(data);
      setError(undefined);
    } catch (error) {
      if (
        !mounted.current ||
        signal.aborted ||
        version !== getAccessTokenVersion() ||
        isCancel(error)
      )
        return;

      if (error instanceof AdminApiError && error.status === 401) {
        clearSession();
        return;
      }

      setError(
        error instanceof Error ? error : new Error(getErrorMessage(error)),
      );
    } finally {
      if (
        mounted.current &&
        !signal.aborted &&
        version === getAccessTokenVersion()
      )
        setLoading(false);
    }
  }, [clearSession, start]);

  const handleLogout = async () => {
    if (!mounted.current || !lock()) return;

    const version = getAccessTokenVersion();
    setLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      if (
        mounted.current &&
        (version === getAccessTokenVersion() || getAccessToken() === null)
      )
        void messageAPI.error(getErrorMessage(error));
    } finally {
      if (mounted.current) {
        unlock();
        setLoggingOut(false);
      }
    }

    if (!mounted.current) return;
    // logout() may clear this session, but a newer login still owns its token.
    if (version !== getAccessTokenVersion() && getAccessToken() !== null)
      return;

    clearSession();
  };

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);

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

  if (!currentUser && loading)
    return (
      <Spin
        aria-label={t("loading")}
        fullscreen
        ref={(node) => node?.nativeElement.setAttribute("role", "status")}
      />
    );

  if (!currentUser)
    return (
      <>
        <RequestError
          error={error ?? new Error(t("currentUserLoadFailed"))}
          onRetry={fetchCurrentUser}
        />
        {error instanceof AdminApiError && error.status === 403 && (
          <Button danger loading={loggingOut} onClick={handleLogout}>
            {t("logout")}
          </Button>
        )}
      </>
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
          backgroundColor: token.colorBgLayout,
          marginInline: "auto",
          maxWidth: token.screenXXXL,
          minWidth: 0,
          paddingBlock: token.paddingMD,
          paddingInline: token.paddingSM,
          width: "100%",
        }}
      >
        {error && <RequestError error={error} onRetry={fetchCurrentUser} />}
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
