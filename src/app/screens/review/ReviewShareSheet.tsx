import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { Clipboard, Share } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Copy, Share2 } from "lucide-react-native";

import { FloatingShareSendButton, InAppShareCard } from "@/components/social";
import { toChatShareRecipient, type ChatShareRecipient } from "@/features/home/chatShare";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useActivityStore } from "@/store/useActivityStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

export type ReviewShareTarget = {
  reviewId: string;
  postId: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  authorName: string;
  message: string;
  link: string;
};

type ReviewShareSheetProps = {
  activeReview: ReviewShareTarget | null;
  innerRef: RefObject<BottomSheetModal | null>;
  bottomInset: number;
  onDismiss: () => void;
  onShared: (reviewId: string) => void;
};

export function ReviewShareSheet({
  activeReview,
  innerRef,
  bottomInset,
  onDismiss,
  onShared,
}: ReviewShareSheetProps) {
  const { palette, spacing } = useHungryTheme();
  const sharePostToChat = useActivityStore((state) => state.sharePostToChat);
  const showToast = useUIStore((state) => state.showToast);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [shareRecipients, setShareRecipients] = useState<ChatShareRecipient[]>([]);
  const snapPoints = useMemo(() => ["62%"], []);

  const loadChatConversations = useCallback(async () => {
    try {
      const conversations = await getHungryService().chat.listConversations();
      setShareRecipients(conversations.map(toChatShareRecipient));
    } catch {
      setShareRecipients([]);
    }
  }, []);

  useEffect(() => {
    if (activeReview) {
      void loadChatConversations();
    }
  }, [activeReview, loadChatConversations]);

  const toggleChat = useCallback((chatId: string) => {
    setSelectedChatIds((current) =>
      current.includes(chatId)
        ? current.filter((candidate) => candidate !== chatId)
        : [...current, chatId],
    );
  }, []);

  const resetAndDismiss = useCallback(() => {
    setSelectedChatIds([]);
    onDismiss();
  }, [onDismiss]);

  const sendToHungryUsers = useCallback(async () => {
    if (!activeReview || selectedChatIds.length === 0) return;

    try {
      await Promise.all(
        selectedChatIds.map((chatId) =>
          sharePostToChat(chatId, {
            postId: activeReview.postId,
            title: activeReview.title,
            subtitle: activeReview.subtitle,
            imageUrl: activeReview.imageUrl,
            authorName: activeReview.authorName,
          }),
        ),
      );
    } catch {
      showToast({ message: "Could not share review. Please try again.", tone: "error" });
      return;
    }
    onShared(activeReview.reviewId);
    showToast({
      message: `Review shared with ${selectedChatIds.length} ${
        selectedChatIds.length === 1 ? "person" : "people"
      }.`,
      tone: "success",
    });
    innerRef.current?.dismiss();
  }, [activeReview, innerRef, onShared, selectedChatIds, sharePostToChat, showToast]);

  const copyLink = useCallback(() => {
    if (!activeReview) return;
    Clipboard.setString(activeReview.link);
    onShared(activeReview.reviewId);
    showToast({ message: "Review link copied.", tone: "success" });
  }, [activeReview, onShared, showToast]);

  const shareOutsideHungry = useCallback(async () => {
    if (!activeReview) return;
    await Share.share({
      message: `${activeReview.message}\n${activeReview.link}`,
      url: activeReview.link,
    });
    onShared(activeReview.reviewId);
  }, [activeReview, onShared]);

  return (
    <>
      <BottomSheetModal
        ref={innerRef}
        snapPoints={snapPoints}
        index={0}
        enablePanDownToClose
        onDismiss={resetAndDismiss}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.4}
            pressBehavior="close"
          />
        )}
        backgroundStyle={{ backgroundColor: palette.surface }}
        handleIndicatorStyle={{ backgroundColor: palette.border }}
        footerComponent={(props) => (
          <BottomSheetFooter {...props}>
            <FloatingShareSendButton
              selectedCount={selectedChatIds.length}
              onPress={sendToHungryUsers}
              bottomInset={bottomInset}
              accessibilityLabel="Send shared review"
              placement="inline"
            />
          </BottomSheetFooter>
        )}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              gap: spacing[3],
              padding: spacing[4],
              paddingBottom: bottomInset + spacing[12],
            }}
          >
            <InAppShareCard
              title="Share review"
              quickActions={[
                {
                  key: "copy",
                  label: "Copy link",
                  accessibilityLabel: "Copy review link",
                  icon: ({ color, size }) => <Copy color={color} size={size} />,
                  onPress: copyLink,
                },
                {
                  key: "share",
                  label: "Share",
                  accessibilityLabel: "Share review to another app",
                  icon: ({ color, size }) => <Share2 color={color} size={size} />,
                  onPress: () => void shareOutsideHungry(),
                },
              ]}
              recipients={shareRecipients}
              selectedRecipientIds={selectedChatIds}
              onToggleRecipient={toggleChat}
              onSend={sendToHungryUsers}
              recipientAccessibilityLabelPrefix="Select"
            />
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
