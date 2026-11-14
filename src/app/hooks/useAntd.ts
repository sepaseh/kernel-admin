import { App, theme } from "antd";

export const useAntd = () => {
  const {
    message: messageAPI,
    modal: modalAPI,
    notification: notificationAPI,
  } = App.useApp();
  const { token } = theme.useToken();
  return { messageAPI, modalAPI, notificationAPI, token };
};
