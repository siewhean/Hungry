import { Component, type ErrorInfo, type ReactNode } from "react";

import { FeedStateView } from "./FeedStateView";

interface FeedErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  body?: string;
  onRetry?: () => void;
}

interface FeedErrorBoundaryState {
  hasError: boolean;
}

export class FeedErrorBoundary extends Component<FeedErrorBoundaryProps, FeedErrorBoundaryState> {
  state: FeedErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): FeedErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Feed render boundary captured an error", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <FeedStateView
          state="error"
          title={this.props.title ?? "We hit a rendering issue"}
          body={this.props.body ?? "Please retry loading this feed."}
          ctaLabel="Retry"
          onPress={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
