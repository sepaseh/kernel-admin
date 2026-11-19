import { useCallback } from "react";
import {
  type NavigateOptions,
  type To,
  useLocation,
  useNavigate,
} from "react-router";

export const getDrawerId = (state: unknown): string | undefined => {
  if (typeof state !== "object" || state === null || !("id" in state))
    return undefined;

  return typeof state.id === "string" && state.id ? state.id : undefined;
};

export const useGoBack = (): ((to?: To, options?: NavigateOptions) => void) => {
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();

  const goBack = useCallback(
    (to?: To, options?: NavigateOptions) => {
      if (state) {
        void navigate(-1);
      } else if (to) {
        void navigate(to, options);
      } else {
        void navigate({ hash: "", pathname, search }, { replace: true });
      }
    },
    [navigate, pathname, search, state],
  );
  return goBack;
};
