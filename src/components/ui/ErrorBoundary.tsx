import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import * as Updates from "expo-updates";

import { reportError } from "@/lib/monitoring/reportError";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * Root error boundary. Always mounted (with or without Sentry) so a render crash shows a
 * friendly screen with a restart action instead of a blank app.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, {
      boundary: "root",
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  private handleRestart = async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // reloadAsync is unavailable in some environments (web, tests); remount the tree instead.
      this.setState({ hasError: false });
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Hardcoded safe values and native Text: the theme provider may be what failed.
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#FFFFFF",
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 22,
            fontWeight: "600",
            marginBottom: 8,
            textAlign: "center",
            color: "#1A2E44",
          }}
        >
          Something went wrong
        </Text>
        <Text style={{ fontSize: 16, textAlign: "center", color: "#41566F", marginBottom: 24 }}>
          The app hit an unexpected error. Restart the app to try again.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restart Hungry"
          onPress={this.handleRestart}
          style={({ pressed }) => ({
            backgroundColor: "#E8531E",
            borderRadius: 999,
            justifyContent: "center",
            minHeight: 48,
            opacity: pressed ? 0.85 : 1,
            paddingHorizontal: 28,
          })}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Restart</Text>
        </Pressable>
      </View>
    );
  }
}
