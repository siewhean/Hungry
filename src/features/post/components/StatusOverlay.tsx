import React, { useEffect } from "react";
import { Alert, Clipboard, Share, StyleSheet, View, ActivityIndicator } from "react-native";
import { CheckCircle2, AlertCircle, X, Calendar, Save } from "lucide-react-native";
import { AppText, Button, IconButton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { publishComposerPost } from "../publishing";
import { useComposerStore } from "../useComposerStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface StatusOverlayProps {
  onFinish?: () => void;
}

export function StatusOverlay({ onFinish }: StatusOverlayProps) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const publishingState = useComposerStore((state) => state.publishingState);
  const publishingError = useComposerStore((state) => state.publishingError);
  const setPublishingState = useComposerStore((state) => state.setPublishingState);
  const setPublishingError = useComposerStore((state) => state.setPublishingError);
  const lastPublishRequest = useComposerStore((state) => state.lastPublishRequest);
  const reset = useComposerStore((state) => state.reset);
  const isMerchantMode = useMerchantStore((state) => Boolean(state.account));
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isUserMode = !isMerchantMode && !isDeveloperMode;
  const retryPublish = async () => {
    if (!lastPublishRequest) {
      setPublishingError("No publish request was found. Please review the post and try again.");
      return;
    }

    setPublishingError(null);
    setPublishingState("posting");
    try {
      await publishComposerPost(lastPublishRequest);
      setPublishingState("success");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while publishing your post. Please try again.";
      setPublishingError(errorMessage);
      setPublishingState("error");
    }
  };
  const shareErrorReport = async () => {
    const report = `Hungry Post Composer Error\nState: ${publishingState}\nError: ${
      publishingError || "Unable to publish post."
    }`;
    try {
      await Clipboard.setString(report);
      await Share.share({ message: report, title: "Hungry Post Composer Error" });
    } catch {
      Alert.alert(
        "Error report",
        "Unable to open sharing options. Error report copied to clipboard.",
      );
    }
  };

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
              borderRadius: componentRadii.card,
              padding: spacing.lg,
              borderColor: palette.border,
              shadowColor: palette.mediaBackdrop,
            },
          ]}
        >
          <Calendar size={20} color={palette.orange} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <AppText variant="bodySmallBold">Post Scheduled!</AppText>
            <AppText variant="micro" tone="secondary">
              Your schedule time has been saved to this composer.
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
  const isReviewOnlySuccess = lastPublishRequest?.publishMode === "review";

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: palette.detailImageOverlay,
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
          {
            backgroundColor: palette.surface,
            borderRadius: componentRadii.card,
            padding: spacing.xxl,
          },
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
                      ? isUserMode
                        ? "Processing..."
                        : "AI Creator Suite..."
                      : "Processing Media..."}
              </AppText>
              <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                {publishingState === "ai_processing"
                  ? isUserMode
                    ? "Your post is being processed."
                    : "Our AI is working its magic to make your post stand out."
                  : "Hold tight, we're making your food look amazing for the community."}
              </AppText>
            </View>
          </View>
        ) : publishingState === "success" ? (
          <View style={styles.content}>
            <CheckCircle2 size={60} color={palette.success} />
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <AppText variant="h2">{isReviewOnlySuccess ? "Review saved" : "Shared!"}</AppText>
              <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                {isReviewOnlySuccess
                  ? "Your review is saved to your profile and the dish details."
                  : "Your content is now live. Get ready for the cravings to start."}
              </AppText>
            </View>
            <Button
              label={isReviewOnlySuccess ? "Done" : "View Post"}
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
                {publishingError ||
                  "We couldn&apos;t publish your post. Please check your connection and try again."}
              </AppText>
            </View>
            <Button
              label="Try Again"
              variant="primary"
              fullWidth
              onPress={() => {
                void retryPublish();
              }}
            />
            <Button label="Send error" variant="secondary" fullWidth onPress={shareErrorReport} />
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
});
