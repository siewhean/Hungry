import { Component, type ErrorInfo, type ReactNode } from "react";
import { Share, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

import { FeedStateView } from "./FeedStateView";

interface FeedErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  body?: string;
  screenName?: string;
  errorContext?: string;
  onRetry?: () => void;
}

interface FeedErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
  errorDetails?: string;
}

export class FeedErrorBoundary extends Component<FeedErrorBoundaryProps, FeedErrorBoundaryState> {
  state: FeedErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): FeedErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message ?? "An unexpected rendering error occurred.",
      errorDetails: `Screen: ${error?.name || "Unknown"}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Feed render boundary captured an error", error, errorInfo);
    this.setState({
      hasError: true,
      errorMessage: error.message || "An unexpected rendering error occurred.",
      errorDetails: errorInfo.componentStack || "No component stack available.",
    });
  }

  private get reportMessage() {
    const context =
      this.props.errorContext ??
      `${this.props.screenName ? `Screen: ${this.props.screenName}` : "Hungry screen"}`;
    const message = this.state.errorMessage ? this.state.errorMessage : "Unknown rendering error.";
    return `${context}\n${this.props.title ?? "Error"}. ${this.props.body ?? "Unexpected rendering error."}\n${message}${
      this.state.errorDetails ? `\n${this.state.errorDetails}` : ""
    }`;
  }

  private handleSendError = async () => {
    const payload = this.reportMessage;
    try {
      await Clipboard.setStringAsync(payload);
    } catch {
      // no-op: fallback to share-only behavior below if clipboard fails
    }

    try {
      await Share.share({ message: payload, title: "Hungry App Error Report" });
    } catch {
      Alert.alert(
        "Error report",
        "Unable to open sharing options. Error text copied to clipboard.",
      );
    }
  };

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
          ctaLabel={this.props.onRetry ? "Retry" : undefined}
          errorMessage={this.state.errorMessage}
          errorContext={this.props.errorContext ?? this.props.title}
          onSendError={this.handleSendError}
          onPress={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
