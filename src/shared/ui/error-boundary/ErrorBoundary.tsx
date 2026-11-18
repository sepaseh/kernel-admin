import { Component, type PropsWithChildren, type ReactElement } from "react";

import { ErrorFallback } from "./ErrorFallback";

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public render(): ReactElement {
    if (this.state.hasError) return <ErrorFallback />;

    return <>{this.props.children}</>;
  }
}
