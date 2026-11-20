import { renderHook } from "@testing-library/react";
import { App, ConfigProvider } from "antd";
import type { PropsWithChildren } from "react";
import { expect, it } from "vitest";

import { useAntd } from "./useAntd";

it("exposes the Ant Design app APIs and active theme token", () => {
  const colorPrimary = "#0055aa";
  const wrapper = ({ children }: PropsWithChildren) => (
    <ConfigProvider theme={{ token: { colorPrimary } }}>
      <App component={false}>{children}</App>
    </ConfigProvider>
  );
  const { result } = renderHook(
    () => ({ app: App.useApp(), antd: useAntd() }),
    { wrapper },
  );

  const { app, antd } = result.current;
  expect(antd.messageAPI).toBe(app.message);
  expect(antd.modalAPI).toBe(app.modal);
  expect(antd.notificationAPI).toBe(app.notification);
  expect(antd.token.colorPrimary).toBe(colorPrimary);
});
