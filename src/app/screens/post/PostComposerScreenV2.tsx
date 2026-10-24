import React, { useEffect } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Haptics from "@/lib/haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "@/features/post/useComposerStore";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";

// Components
import { ComposerHeader } from "@/features/post/components/ComposerHeader";
import { TabSwitcher } from "@/features/post/components/TabSwitcher";
import { MediaManager } from "@/features/post/components/MediaManager";
import { SharedMetadata } from "@/features/post/components/SharedMetadata";
import { PostTab } from "@/features/post/components/PostTab";
import { ReviewTab } from "@/features/post/components/ReviewTab";
import { ComposerBottomBar } from "@/features/post/components/ComposerBottomBar";
import { StatusOverlay } from "@/features/post/components/StatusOverlay";
import { LivePreviewSheet } from "@/features/post/components/LivePreviewSheet";
import { MusicSearchModal } from "@/features/post/components/MusicSearchModal";
import { LocationSearchModal } from "@/features/post/components/LocationSearchModal";
import { CollaboratorModal } from "@/features/post/components/CollaboratorModal";

import { Sparkles, TrendingUp, Clock, BarChart3, Eye } from "lucide-react-native";
import { AppText, Card, Button, Dialog } from "@/components/ui";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

type Props = NativeStackScreenProps<RootStackParamList, "PostComposerV2">;
type BeforeRemoveEvent = {
  preventDefault: () => void;
};

export function PostComposerScreenV2({ navigation, route }: Props) {
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const activeTab = useComposerStore((state) => state.activeTab);
  const isMerchantMode = useMerchantStore(isMerchantModeActive);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isUserMode = !isMerchantMode && !isDeveloperMode;
  const shouldShowAiSuite = !isUserMode;
  const reset = useComposerStore((state) => state.reset);

  const musicModalRef = React.useRef<BottomSheetModal>(null);
  const locationModalRef = React.useRef<BottomSheetModal>(null);
  const collaboratorModalRef = React.useRef<BottomSheetModal>(null);
  const allowExitRef = React.useRef(false);

  const [showExitDialog, setShowExitDialog] = React.useState(false);

  // Draft exit handling
  const postCaption = useComposerStore((state) => state.postCaption);
  const reviewCaption = useComposerStore((state) => state.reviewCaption);
  const media = useComposerStore((state) => state.media);
  const setPublishingState = useComposerStore((state) => state.setPublishingState);

  const returnToHomeFeed = React.useCallback(() => {
    navigation.dispatch({
      type: "POP_TO",
      payload: { name: "MainTabs", params: { screen: "Home" } },
    });
  }, [navigation]);

  const finishAndReturnToHomeFeed = React.useCallback(() => {
    allowExitRef.current = true;
    returnToHomeFeed();
  }, [returnToHomeFeed]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: BeforeRemoveEvent) => {
      if (allowExitRef.current) {
        return;
      }

      // If there's no meaningful content, just leave
      const hasContent =
        media.length > 0 || postCaption.trim().length > 0 || reviewCaption.trim().length > 0;

      if (!hasContent) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();
      setShowExitDialog(true);
    });

    return unsubscribe;
  }, [navigation, media.length, postCaption, reviewCaption]);

  const generateCaptionIdeas = useComposerStore((state) => state.generateCaptionIdeas);
  const suggestBestTime = useComposerStore((state) => state.suggestBestTime);
  const optimiseCaption = useComposerStore((state) => state.optimiseCaption);
  const isAiProcessing = useComposerStore((state) => state.isAiProcessing);

  const handleAiAction = async (action: () => Promise<void>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await action();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View testID="post-composer-screen" style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={{ zIndex: 100 }}>
        <ComposerHeader onClose={returnToHomeFeed} />
      </View>

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: semanticSpacing.sectionGap + semanticSpacing.heroGap + insets.bottom,
        }}
        style={{ flex: 1 }}
      >
        {/* Sticky Tab Switcher */}
        <TabSwitcher />

        {/* Media Section (Post) */}
        <MediaManager />

        {/* Tab Specific Content (Caption, Music, etc.) */}
        {activeTab === "post" ? (
          <PostTab onOpenMusic={() => musicModalRef.current?.present()} />
        ) : (
          <ReviewTab />
        )}

        {/* Shared Metadata (Location, Collaborators, Tags) */}
        <View style={{ marginTop: 0 }}>
          <SharedMetadata
            onOpenLocation={() => locationModalRef.current?.present()}
            onOpenCollaborators={() => collaboratorModalRef.current?.present()}
          />
        </View>

        {/* AI Assistant Section - Global bottom */}
        {shouldShowAiSuite && (
          <View style={{ padding: spacing.xl, gap: spacing.lg, marginTop: spacing.lg }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              <Sparkles size={18} color={palette.orange} />
              <AppText variant="bodyBold">AI Creator Suite</AppText>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
              }}
            >
              <Pressable onPress={() => handleAiAction(generateCaptionIdeas)} style={{ flex: 1 }}>
                <Card
                  style={[
                    styles.aiCard,
                    {
                      borderColor: palette.orange,
                      backgroundColor: palette.surface,
                      gap: spacing.xs,
                    },
                  ]}
                >
                  <TrendingUp size={20} color={palette.orange} />
                  <AppText variant="micro" style={{ fontWeight: "700", textAlign: "center" }}>
                    Caption Ideas
                  </AppText>
                </Card>
              </Pressable>
              <Pressable onPress={() => handleAiAction(suggestBestTime)} style={{ flex: 1 }}>
                <Card
                  style={[
                    styles.aiCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      gap: spacing.xs,
                    },
                  ]}
                >
                  <Clock size={20} color={palette.text} />
                  <AppText variant="micro" style={{ fontWeight: "700", textAlign: "center" }}>
                    Best Time
                  </AppText>
                </Card>
              </Pressable>
              <Pressable onPress={() => handleAiAction(optimiseCaption)} style={{ flex: 1 }}>
                <Card
                  style={[
                    styles.aiCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      gap: spacing.xs,
                    },
                  ]}
                >
                  <BarChart3 size={20} color={palette.text} />
                  <AppText variant="micro" style={{ fontWeight: "700", textAlign: "center" }}>
                    Optimise
                  </AppText>
                </Card>
              </Pressable>
            </View>

            {/* Preview Section */}
            <Button
              label="Live Preview"
              variant="secondary"
              onPress={() => useComposerStore.getState().setShowPreview(true)}
              leftIcon={<Eye size={18} color={palette.text} />}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        )}
      </ScrollView>

      {/* Overlays & Fixed Components */}
      <ComposerBottomBar routeDishId={route.params?.dishId} routeVenueId={route.params?.venueId} />
      <StatusOverlay onFinish={finishAndReturnToHomeFeed} />
      <LivePreviewSheet />
      <MusicSearchModal innerRef={musicModalRef} />
      <LocationSearchModal innerRef={locationModalRef} />
      <CollaboratorModal innerRef={collaboratorModalRef} />

      <Dialog
        visible={showExitDialog}
        title="Save draft?"
        message="You have unsaved changes. Would you like to save this as a draft before leaving?"
        onClose={() => setShowExitDialog(false)}
        buttons={[
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              setShowExitDialog(false);
              reset();
              finishAndReturnToHomeFeed();
            },
          },
          {
            text: "Save draft",
            onPress: () => {
              setPublishingState("draft");
              setShowExitDialog(false);
              setTimeout(() => {
                reset();
                finishAndReturnToHomeFeed();
              }, 1500);
            },
          },
          {
            text: "Keep editing",
            style: "cancel",
            onPress: () => setShowExitDialog(false),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  aiCard: {
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
