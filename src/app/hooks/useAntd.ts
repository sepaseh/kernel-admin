import { App as AntdApp, theme as antdTheme } from "antd";
import { createElement } from "react";

import { trapDialogFocus } from "@/shared/lib/dialog-focus";

export const useAntd = () => {
  const {
    message: messageAPI,
    modal,
    notification: notificationAPI,
  } = AntdApp.useApp();
  const { token } = antdTheme.useToken();
  const modalAPI = {
    ...modal,
    confirm: (config: Parameters<typeof modal.confirm>[0]) =>
      modal.confirm({
        ...config,
        modalRender: (node) =>
          createElement(
            "div",
            { onKeyDown: trapDialogFocus },
            config.modalRender ? config.modalRender(node) : node,
          ),
      }),
  };
  return { messageAPI, modalAPI, notificationAPI, token };
};
