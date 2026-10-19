import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { Clipboard, Share } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Copy, MessageCircle, Send, Share2 } from "lucide-react-native";

import { FloatingShareSendButton, InAppShareCard } from "@/components/social";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { toChatShareRecipient, type ChatShareRecipient } from "@/features/home/chatShare";
import { buildTelegramShareUrl, buildWhatsAppShareUrl } from "@/features/share/messagingShare";
import { withShareSource } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openTrustedMessagingShareUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useActivityStore } from "@/store/useActivityStore";
import type { ShareChannel } from "@/store/useSocialStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

export type ReviewShareTarget = {
  reviewId: string;
  /** Set only when the shared item IS this post; reviews leave it empty. */
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
  onShared: (postId: string, channel: ShareChannel) => void;
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
  const directMessagesEnabled = FEATURE_FLAGS.directMessagesEnabled;
  const snapPoints = useMemo(() => ["62%"], []);

  const loadChatConversations = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) {
      setShareRecipients([]);
      return;
    }

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
    if (!FEATURE_FLAGS.directMessagesEnabled) return;
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
    if (activeReview.postId) {
      onShared(activeReview.postId, "in_app");
    }
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
    Clipboard.setString(withShareSource(activeReview.link, "copy_link"));
    trackAnalyticsEvent("dish_shared", { review_id: activeReview.reviewId, channel: "copy_link" });
    if (activeReview.postId) {
      onShared(activeReview.postId, "copy_link");
    }
    showToast({ message: "Review link copied.", tone: "success" });
  }, [activeReview, onShared, showToast]);

  const shareOutsideHungry = useCallback(async () => {
    if (!activeReview) return;
    const link = withShareSource(activeReview.link, "system_share");
    const result = await Share.share({
      message: `${activeReview.message}\n${link}`,
      url: link,
    });
    // A cancelled share sheet is not a share.
    if (result.action !== Share.sharedAction) return;
    trackAnalyticsEvent("dish_shared", {
      review_id: activeReview.reviewId,
      channel: "system_share",
    });
    if (activeReview.postId) {
      onShared(activeReview.postId, "system_share");
    }
  }, [activeReview, onShared]);

  const shareToMessagingApp = useCallback(
    async (channel: "whatsapp" | "telegram") => {
      if (!activeReview) return;
      const link = withShareSource(activeReview.link, channel);
      await openTrustedMessagingShareUrl(
        channel === "whatsapp"
          ? buildWhatsAppShareUrl(activeReview.message, link)
          : buildTelegramShareUrl(activeReview.message, link),
      );
      trackAnalyticsEvent("dish_shared", { review_id: activeReview.reviewId, channel });
      if (activeReview.postId) {
        onShared(activeReview.postId, channel);
      }
    },
    [activeReview, onShared],
  );

  return (
    <>
      <BottomSheetModal
        ref={innerRef}
        snapPoints={snapPoints}
        index={0}
        enablePanDownToClose
        accessibilityLabel="Share review"
        accessibilityViewIsModal
        onDismiss={resetAndDismiss}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.4}
            pressBehavior="close"
            accessibilityRole="button"
            accessibilityLabel="Close share sheet"
            accessibilityHint="Dismisses the review sharing sheet"
          />
        )}
        backgroundStyle={{ backgroundColor: palette.surface }}
        handleIndicatorStyle={{ backgroundColor: palette.border }}
        footerComponent={
          directMessagesEnabled
            ? (props) => (
                <BottomSheetFooter {...props}>
                  <FloatingShareSendButton
                    selectedCount={selectedChatIds.length}
                    onPress={sendToHungryUsers}
                    bottomInset={bottomInset}
                    accessibilityLabel="Send shared review"
                    placement="inline"
                  />
                </BottomSheetFooter>
              )
            : undefined
        }
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
              title={directMessagesEnabled ? "Share review" : "Share review link"}
              quickActions={[
                {
                  key: "copy",
                  label: "Copy link",
                  accessibilityLabel: "Copy review link",
                  icon: ({ color, size }) => <Copy color={color} size={size} />,
                  onPress: copyLink,
                },
                {
                  key: "whatsapp",
                  label: "WhatsApp",
                  accessibilityLabel: "Share on WhatsApp",
                  icon: ({ color, size }) => <MessageCircle color={color} size={size} />,
                  onPress: () => void shareToMessagingApp("whatsapp"),
                },
                {
                  key: "telegram",
                  label: "Telegram",
                  accessibilityLabel: "Share on Telegram",
                  icon: ({ color, size }) => <Send color={color} size={size} />,
                  onPress: () => void shareToMessagingApp("telegram"),
                },
                {
                  key: "share",
                  label: "Share",
                  accessibilityLabel: "Share review to another app",
                  icon: ({ color, size }) => <Share2 color={color} size={size} />,
                  onPress: () => void shareOutsideHungry(),
                },
              ]}
              recipients={directMessagesEnabled ? shareRecipients : []}
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
