import React, { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { CheckCircle2, AlertCircle, X, Calendar, Save } from "lucide-react-native";
import { AppText, Button, IconButton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface StatusOverlayProps {
  onFinish?: () => void;
}

export function StatusOverlay({ onFinish }: StatusOverlayProps) {
  const { palette, spacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const publishingState = useComposerStore((state) => state.publishingState);
  const setPublishingState = useComposerStore((state) => state.setPublishingState);
  const reset = useComposerStore((state) => state.reset);

  useEffect(() => {
    if (publishingState === "scheduled") {
      const timer = setTimeout(() => {
        setPublishingState("editing");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [publishingState]);

  if (publishingState === "empty" || publishingState === "editing") return null;

  if (publishingState === "scheduled") {
    return (
      <View
        style={[
          styles.toastContainer,
          { top: insets.top + spacing.md, paddingHorizontal: spacing.xl },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.toast,
            {
              backgroundColor: palette.surface,
              borderRadius: radii.md,
              padding: spacing.lg,
              borderColor: palette.border,
            },
          ]}
        >
          <Calendar size={20} color={palette.orange} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <AppText variant="bodySmallBold">Post Scheduled!</AppText>
            <AppText variant="micro" tone="secondary">
              Your post will go live at the set time.
            </AppText>
          </View>
        </View>
      </View>
    );
  }

  const isProcessing =
    publishingState === "posting" ||
    publishingState === "uploading" ||
    publishingState === "processing" ||
    publishingState === "ai_processing";

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: "rgba(0,0,0,0.7)",
          zIndex: 1000,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xxxl,
        },
      ]}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderRadius: radii.xl, padding: spacing.xxl },
        ]}
      >
        {isProcessing ? (
          <View style={styles.content}>
            <ActivityIndicator size="large" color={palette.orange} />
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <AppText variant="h3">
                {publishingState === "posting"
                  ? "Publishing..."
                  : publishingState === "uploading"
                    ? "Uploading Media..."
                    : publishingState === "ai_processing"
                      ? "AI Creator Suite..."
                      : "Processing Media..."}
              </AppText>
              <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                {publishingState === "ai_processing"
                  ? "Our AI is working its magic to make your post stand out."
                  : "Hold tight, we're making your food look amazing for the community."}
              </AppText>
            </View>
          </View>
        ) : publishingState === "success" ? (
          <View style={styles.content}>
            <CheckCircle2 size={60} color={palette.success} />
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <AppText variant="h2">Shared!</AppText>
              <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                Your content is now live. Get ready for the cravings to start.
              </AppText>
            </View>
            <Button
              label="View Post"
              variant="primary"
              fullWidth
              onPress={() => {
                reset();
                onFinish?.();
              }}
            />
            <Button label="Create Another" variant="ghost" fullWidth onPress={reset} />
          </View>
        ) : publishingState === "draft" ? (
          <View style={styles.content}>
            <Save size={60} color={palette.text} />
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <AppText variant="h2">Draft Saved</AppText>
              <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                Your changes have been saved to your local drafts.
              </AppText>
            </View>
            <Button
              label="Keep Editing"
              variant="primary"
              fullWidth
              onPress={() => setPublishingState("editing")}
            />
            <Button
              label="Finish Later"
              variant="ghost"
              fullWidth
              onPress={() => {
                reset();
                onFinish?.();
              }}
            />
          </View>
        ) : publishingState === "error" ? (
          <View style={styles.content}>
            <AlertCircle size={60} color={palette.error} />
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <AppText variant="h3">Something went wrong</AppText>
              <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                We couldn&apos;t publish your post. Please check your connection and try again.
              </AppText>
            </View>
            <Button
              label="Try Again"
              variant="primary"
              fullWidth
              onPress={() => setPublishingState("posting")}
            />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              onPress={() => setPublishingState("editing")}
            />
          </View>
        ) : null}

        {!isProcessing && (
          <IconButton
            variant="ghost"
            style={styles.closeBtn}
            accessibilityLabel="Close overlay"
            onPress={() => setPublishingState("editing")}
            icon={<X size={24} color={palette.textMuted} />}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    position: "relative",
  },
  content: {
    alignItems: "center",
    gap: 24,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  toastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
});
