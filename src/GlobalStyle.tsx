import { createGlobalStyle } from "antd-style";

export const GlobalStyle = createGlobalStyle(({ theme }) => ({
  body: {
    backgroundColor: theme.colorBgBase,
    color: theme.colorTextBase,
  },
}));
