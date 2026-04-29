import React, { useEffect } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "@/features/post/useComposerStore";

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
import { MediaEditor } from "@/features/post/components/MediaEditor";
import { MusicSearchModal } from "@/features/post/components/MusicSearchModal";
import { LocationSearchModal } from "@/features/post/components/LocationSearchModal";
import { CollaboratorModal } from "@/features/post/components/CollaboratorModal";

import { Sparkles, TrendingUp, Clock, BarChart3, Eye } from "lucide-react-native";
import { AppText, Card, Button, Dialog } from "@/components/ui";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

type Props = NativeStackScreenProps<RootStackParamList, "PostComposerV2">;

export function PostComposerScreenV2({ navigation }: Props) {
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const activeTab = useComposerStore((state) => state.activeTab);
  const reset = useComposerStore((state) => state.reset);
  const editingMediaId = useComposerStore((state) => state.editingMediaId);
  const setEditingMediaId = useComposerStore((state) => state.setEditingMediaId);

  const musicModalRef = React.useRef<BottomSheetModal>(null);
  const locationModalRef = React.useRef<BottomSheetModal>(null);
  const collaboratorModalRef = React.useRef<BottomSheetModal>(null);

  const [showExitDialog, setShowExitDialog] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<any>(null);

  // Draft exit handling
  const postCaption = useComposerStore((state) => state.postCaption);
  const reviewCaption = useComposerStore((state) => state.reviewCaption);
  const media = useComposerStore((state) => state.media);
  const setPublishingState = useComposerStore((state) => state.setPublishingState);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      // If there's no meaningful content, just leave
      const hasContent = media.length > 0 || postCaption.trim().length > 0 || reviewCaption.trim().length > 0;
      
      if (!hasContent) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();
      setPendingAction(e.data.action);
      setShowExitDialog(true);
    });

    return unsubscribe;
  }, [navigation, media.length, postCaption, reviewCaption]);

  // Initialize with some mock data if empty
  const addMedia = useComposerStore((state) => state.addMedia);

  useEffect(() => {
    if (media.length === 0) {
      addMedia([
        {
          id: "initial-1",
          uri: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
          type: "image",
        },
      ]);
    }
  }, []);

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
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={{ zIndex: 100 }}>
        <ComposerHeader onClose={() => navigation.goBack()} />
      </View>

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: semanticSpacing.sectionGap + semanticSpacing.heroGap + insets.bottom }}
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
        <View style={{ padding: spacing.xl, gap: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }}>
            <Sparkles size={18} color={palette.orange} />
            <AppText variant="bodyBold">AI Creator Suite</AppText>
          </View>
          
          <View 
            style={{ 
              flexDirection: "row",
              gap: spacing.md,
            }}
          >
            <Pressable 
              onPress={() => handleAiAction(generateCaptionIdeas)}
              style={{ flex: 1 }}
            >
              <Card style={[styles.aiCard, { borderColor: palette.orange, backgroundColor: palette.surface, gap: spacing.xs }]}>
                <TrendingUp size={20} color={palette.orange} />
                <AppText variant="micro" style={{ fontWeight: "700", textAlign: 'center' }}>Caption Ideas</AppText>
              </Card>
            </Pressable>
            <Pressable 
              onPress={() => handleAiAction(suggestBestTime)}
              style={{ flex: 1 }}
            >
              <Card style={[styles.aiCard, { backgroundColor: palette.surface, borderColor: palette.border, gap: spacing.xs }]}>
                <Clock size={20} color={palette.text} />
                <AppText variant="micro" style={{ fontWeight: "700", textAlign: 'center' }}>Best Time</AppText>
              </Card>
            </Pressable>
            <Pressable 
              onPress={() => handleAiAction(optimiseCaption)}
              style={{ flex: 1 }}
            >
              <Card style={[styles.aiCard, { backgroundColor: palette.surface, borderColor: palette.border, gap: spacing.xs }]}>
                <BarChart3 size={20} color={palette.text} />
                <AppText variant="micro" style={{ fontWeight: "700", textAlign: 'center' }}>Optimise</AppText>
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
      </ScrollView>

      {/* Overlays & Fixed Components */}
      <ComposerBottomBar />
      <StatusOverlay />
      <LivePreviewSheet />
      <MediaEditor mediaId={editingMediaId} onClose={() => setEditingMediaId(null)} />
      <MusicSearchModal innerRef={musicModalRef} />
      <LocationSearchModal innerRef={locationModalRef} />
      <CollaboratorModal innerRef={collaboratorModalRef} />

      <Dialog
        visible={showExitDialog}
        title="Save Draft?"
        message="You have unsaved changes. Would you like to save this as a draft before leaving?"
        onClose={() => setShowExitDialog(false)}
        buttons={[
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              reset();
              navigation.dispatch(pendingAction);
            },
          },
          {
            text: "Save Draft",
            onPress: () => {
              setPublishingState("draft");
              setTimeout(() => {
                navigation.dispatch(pendingAction);
              }, 1500);
            },
          },
          {
            text: "Keep Editing",
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
