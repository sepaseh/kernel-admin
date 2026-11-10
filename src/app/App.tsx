import { lazy, Suspense } from "react";

import { GlobalStyle } from "@/GlobalStyle";
import { AntdProvider } from "@/app/providers/antd";
import { CoreProvider } from "@/app/providers/core";
import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { RouteLoading } from "@/shared/ui/route-loading";

const Routes = lazy(async () => ({
  default: (await import("./Routes")).Routes,
}));

export const App = () => (
  <ErrorBoundary>
    <CoreProvider>
      <AntdProvider>
        <GlobalStyle />
        <Suspense fallback={<RouteLoading />}>
          <Routes />
        </Suspense>
      </AntdProvider>
    </CoreProvider>
  </ErrorBoundary>
);
