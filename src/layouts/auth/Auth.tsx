import { useEffect } from "react";
import { Outlet } from "react-router";

import { useAntd } from "@/app/hooks";
import { clearAccessToken } from "@/shared/api";

export const AuthLayout = () => {
  const { token } = useAntd();

  useEffect(() => {
    clearAccessToken();
  }, []);

  return (
    <main
      style={{
        alignItems: "center",
        backgroundColor: token.colorBgLayout,
        boxSizing: "border-box",
        display: "flex",
        flexGrow: 1,
        justifyContent: "center",
        minHeight: "100dvh",
        padding: token.paddingSM,
      }}
    >
      <div
        style={{
          backgroundColor: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          boxSizing: "border-box",
          color: token.colorTextBase,
          maxWidth: token.screenXS,
          padding: token.paddingLG,
          width: "100%",
        }}
      >
        <Outlet />
      </div>
    </main>
  );
};
