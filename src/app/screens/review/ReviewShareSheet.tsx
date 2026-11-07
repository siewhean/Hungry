import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Copy, Image as ImageIcon, MessageCircle, Send, Share2 } from "lucide-react-native";

import { ReviewShareStudioModal } from "@/components/share/ReviewShareStudio";
import { FloatingShareSendButton, InAppShareCard } from "@/components/social";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { toChatShareRecipient, type ChatShareRecipient } from "@/features/home/chatShare";
import { buildTelegramShareUrl, buildWhatsAppShareUrl } from "@/features/share/messagingShare";
import { withShareSource } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { openTrustedMessagingShareUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useActivityStore } from "@/store/useActivityStore";
import type { ShareChannel } from "@/store/useSocialStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AppSymbol } from "@/components/ui/AppSymbol";

export type ShareTargetKind = "review" | "dish" | "stall";

export type ReviewShareTarget = {
  /** What is being shared; sets the sheet title and the analytics event. Defaults to "review". */
  kind?: ShareTargetKind;
  reviewId: string;
  /** Set only when the shared item IS this post; reviews leave it empty. */
  postId: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  authorName: string;
  message: string;
  link: string;
  /** Dish shares: the stall name printed on the picture card. */
  venueName?: string;
};

/** The picture card for a dish or stall shared without a review: no stars, no words. */
export function pictureCardFor(target: ReviewShareTarget) {
  return {
    reviewId: target.reviewId,
    dishName: target.title,
    venueName: target.kind === "dish" ? (target.venueName ?? "") : "",
    rating: 0,
    photoUrl: target.imageUrl || undefined,
    authorName: target.authorName,
  };
}

type ReviewShareSheetProps = {
  activeReview: ReviewShareTarget | null;
  innerRef: RefObject<BottomSheetModal | null>;
  bottomInset: number;
  onDismiss: () => void;
  onShared: (postId: string, channel: ShareChannel) => void;
  /** Called after every completed share, on any channel (copy, apps, system, in-app). */
  onShareCompleted?: (channel: ShareChannel) => void;
  /** False for signed-out viewers: only link/system shares, no in-app sends. */
  inAppSharingEnabled?: boolean;
};

const EMPTY_TARGET: ReviewShareTarget = {
  reviewId: "",
  postId: "",
  title: "",
  subtitle: "",
  imageUrl: "",
  authorName: "",
  message: "",
  link: "",
};

export function ReviewShareSheet({
  activeReview,
  innerRef,
  bottomInset,
  onDismiss,
  onShared,
  onShareCompleted,
  inAppSharingEnabled = true,
}: ReviewShareSheetProps) {
  const { palette, spacing } = useHungryTheme();
  const sharePostToChat = useActivityStore((state) => state.sharePostToChat);
  const showToast = useUIStore((state) => state.showToast);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [shareRecipients, setShareRecipients] = useState<ChatShareRecipient[]>([]);
  // Kept apart from activeReview: the sheet closes (and clears it) before the studio opens.
  const [pictureTarget, setPictureTarget] = useState<ReviewShareTarget | null>(null);
  const kind = activeReview?.kind ?? "review";
  const kindNoun = kind === "stall" ? "stall" : kind === "dish" ? "dish" : "review";
  // A chat share sends a post card, so it needs a real post id.
  const directMessagesEnabled =
    FEATURE_FLAGS.directMessagesEnabled && inAppSharingEnabled && Boolean(activeReview?.postId);
  // Without in-app recipients the sheet holds only the four link actions: keep it short.
  // The link-only sheet is as tall as its content (about 150) plus the home-indicator inset,
  // so there is no empty band under the four actions.
  const snapPoints = useMemo(
    () => [directMessagesEnabled ? "62%" : 150 + bottomInset + 24],
    [directMessagesEnabled, bottomInset],
  );

  const loadChatConversations = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) {
      setShareRecipients([]);
      return;
    }
    if (!inAppSharingEnabled) {
      setShareRecipients([]);
      return;
    }

    try {
      const conversations = await getHungryService().chat.listConversations();
      setShareRecipients(conversations.map(toChatShareRecipient));
    } catch (error) {
      reportError(error, { screen: "ReviewShareSheet", action: "list_conversations" });
      setShareRecipients([]);
    }
  }, [inAppSharingEnabled]);

  useEffect(() => {
    if (activeReview) {
      void loadChatConversations();
    }
  }, [activeReview, loadChatConversations]);

  const trackShare = useCallback(
    (target: ReviewShareTarget, channel: ShareChannel, recipientCount?: number) => {
      const targetKind = target.kind ?? "review";
      const recipients = recipientCount === undefined ? {} : { recipient_count: recipientCount };
      if (targetKind === "stall") {
        trackAnalyticsEvent("stall_shared", {
          stall_id: target.reviewId.replace(/^stall-/, ""),
          channel,
          ...recipients,
        });
      } else if (targetKind === "dish") {
        trackAnalyticsEvent("dish_shared", {
          dish_id: target.reviewId.replace(/^dish-/, ""),
          channel,
          ...recipients,
        });
      } else {
        trackAnalyticsEvent("review_shared", {
          review_id: target.reviewId,
          channel,
          ...recipients,
        });
      }
      if (target.postId) {
        onShared(target.postId, channel);
      }
      onShareCompleted?.(channel);
    },
    [onShareCompleted, onShared],
  );

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
    if (!directMessagesEnabled) return;
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
    } catch (error) {
      reportError(error, { screen: "ReviewShareSheet", action: "share_to_chat" });
      showToast({ message: "Could not share review. Please try again.", tone: "error" });
      return;
    }
    trackShare(activeReview, "in_app", selectedChatIds.length);
    showToast({
      message: `${kindNoun === "review" ? "Review" : kindNoun === "dish" ? "Dish" : "Stall"} shared with ${selectedChatIds.length} ${
        selectedChatIds.length === 1 ? "person" : "people"
      }.`,
      tone: "success",
    });
    innerRef.current?.dismiss();
  }, [
    activeReview,
    directMessagesEnabled,
    innerRef,
    kindNoun,
    selectedChatIds,
    sharePostToChat,
    showToast,
    trackShare,
  ]);

  const copyLink = useCallback(async () => {
    if (!activeReview) return;
    await Clipboard.setStringAsync(withShareSource(activeReview.link, "copy_link"));
    trackShare(activeReview, "copy_link");
    showToast({ message: "Link copied.", tone: "success" });
  }, [activeReview, showToast, trackShare]);

  const shareOutsideHungry = useCallback(async () => {
    if (!activeReview) return;
    const link = withShareSource(activeReview.link, "system_share");
    // iOS shows `url` as its own item, so the link goes there only; Android has no `url`.
    const result = await Share.share(
      Platform.OS === "ios"
        ? { message: activeReview.message, url: link }
        : { message: `${activeReview.message}\n${link}` },
    );
    // A cancelled share sheet is not a share.
    if (result.action !== Share.sharedAction) return;
    trackShare(activeReview, "system_share");
  }, [activeReview, trackShare]);

  const shareToMessagingApp = useCallback(
    async (channel: "whatsapp" | "telegram") => {
      if (!activeReview) return;
      const link = withShareSource(activeReview.link, channel);
      await openTrustedMessagingShareUrl(
        channel === "whatsapp"
          ? buildWhatsAppShareUrl(activeReview.message, link)
          : buildTelegramShareUrl(activeReview.message, link),
      );
      trackShare(activeReview, channel);
    },
    [activeReview, trackShare],
  );

  const openPictureCard = useCallback(() => {
    if (!activeReview) return;
    trackAnalyticsEvent("share_picture_opened", { kind });
    setPictureTarget(activeReview);
    innerRef.current?.dismiss();
  }, [activeReview, innerRef, kind]);

  const pictureActions =
    kind === "review"
      ? []
      : [
          {
            key: "picture",
            label: "Picture",
            accessibilityLabel: `Share ${kindNoun} as a picture`,
            icon: ({ color, size }: { color: string; size: number }) => (
              <ImageIcon color={color} size={size} />
            ),
            onPress: openPictureCard,
          },
        ];

  return (
    <>
      <BottomSheetModal
        ref={innerRef}
        snapPoints={snapPoints}
        index={0}
        enablePanDownToClose
        accessibilityLabel={`Share ${kindNoun}`}
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
            accessibilityHint={`Dismisses the ${kindNoun} sharing sheet`}
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
                    accessibilityLabel={`Send shared ${kindNoun}`}
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
              paddingBottom: directMessagesEnabled ? bottomInset + spacing[12] : bottomInset,
            }}
          >
            <InAppShareCard
              title={directMessagesEnabled ? `Share ${kindNoun}` : `Share ${kindNoun} link`}
              quickActions={[
                {
                  key: "copy",
                  label: "Copy link",
                  accessibilityLabel: `Copy ${kindNoun} link`,
                  icon: ({ color, size }) => (
                    <AppSymbol name="doc.on.doc" fallback={Copy} size={size} color={color} />
                  ),
                  onPress: copyLink,
                },
                {
                  key: "whatsapp",
                  label: "WhatsApp",
                  accessibilityLabel: "Share on WhatsApp",
                  icon: ({ color, size }) => (
                    <AppSymbol
                      name="bubble.left"
                      fallback={MessageCircle}
                      size={size}
                      color={color}
                    />
                  ),
                  onPress: () => void shareToMessagingApp("whatsapp"),
                },
                {
                  key: "telegram",
                  label: "Telegram",
                  accessibilityLabel: "Share on Telegram",
                  icon: ({ color, size }) => (
                    <AppSymbol name="paperplane" fallback={Send} size={size} color={color} />
                  ),
                  onPress: () => void shareToMessagingApp("telegram"),
                },
                {
                  key: "share",
                  label: "Share",
                  accessibilityLabel: `Share ${kindNoun} to another app`,
                  icon: ({ color, size }) => (
                    <AppSymbol
                      name="square.and.arrow.up"
                      fallback={Share2}
                      size={size}
                      color={color}
                    />
                  ),
                  onPress: () => void shareOutsideHungry(),
                },
                ...pictureActions,
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
      <ReviewShareStudioModal
        visible={pictureTarget !== null}
        card={pictureTarget ? pictureCardFor(pictureTarget) : pictureCardFor(EMPTY_TARGET)}
        link={pictureTarget?.link ?? ""}
        source={pictureTarget?.kind === "stall" ? "stall_page" : "dish_page"}
        onClose={() => setPictureTarget(null)}
      />
    </>
  );
}
