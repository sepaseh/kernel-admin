import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactElement,
} from "react";

import { reportError } from "@/shared/lib";

import { ErrorFallback } from "./ErrorFallback";

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(error, {
      componentStack: errorInfo.componentStack,
      source: "react.error-boundary",
    });
  }

  public render(): ReactElement {
    if (this.state.hasError) return <ErrorFallback />;

    return <>{this.props.children}</>;
  }
}
