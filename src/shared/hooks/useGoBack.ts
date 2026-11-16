import { useCallback } from "react";
import {
  type NavigateOptions,
  type To,
  useLocation,
  useNavigate,
} from "react-router";

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
