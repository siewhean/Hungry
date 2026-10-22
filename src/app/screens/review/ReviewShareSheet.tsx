import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Clipboard, Share } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Copy, MessageCircle, Send, Share2 } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import { FloatingShareSendButton, InAppShareCard } from "@/components/social";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { toChatShareRecipient, type ChatShareRecipient } from "@/features/home/chatShare";
import { buildTelegramShareUrl, buildWhatsAppShareUrl } from "@/features/share/messagingShare";
import { withShareSource } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openTrustedMessagingShareUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getAccountGeneration } from "@/lib/security/accountScope";
import { useSessionStore } from "@/store/useSessionStore";
import { createClientReviewId } from "@/features/review/reviewDraft";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

export type ReviewShareTarget = {
  reviewId: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  authorName: string;
  message: string;
  link: string;
};

type ReviewShareSheetProps = {
  activeReview: ReviewShareTarget | null;
  subjectLabel?: "dish" | "post" | "stall";
  innerRef: RefObject<BottomSheetModal | null>;
  bottomInset: number;
  onDismiss: () => void;
};

export function ReviewShareSheet({
  activeReview,
  subjectLabel = "dish",
  innerRef,
  bottomInset,
  onDismiss,
}: ReviewShareSheetProps) {
  const { palette, spacing } = useHungryTheme();
  const subjectTitle =
    subjectLabel === "post" ? "Post" : subjectLabel === "stall" ? "Stall" : "Dish";
  const sending = useRef(false);
  const targetGeneration = useRef(0);
  const accountId = useSessionStore((state) => state.authenticatedUserId);
  const nonces = useRef(new Map<string, string>());
  const showToast = useUIStore((state) => state.showToast);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [recipientError, setRecipientError] = useState(false);
  const [shareRecipients, setShareRecipients] = useState<ChatShareRecipient[]>([]);
  const directMessagesEnabled = FEATURE_FLAGS.directMessagesEnabled;
  const snapPoints = useMemo(() => ["62%"], []);

  const loadChatConversations = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) {
      setShareRecipients([]);
      return;
    }

    setRecipientError(false);
    try {
      const generation = getAccountGeneration();
      const target = targetGeneration.current;
      const conversations = await getHungryService().chat.listConversations();
      if (generation !== getAccountGeneration() || target !== targetGeneration.current) return;
      setShareRecipients(conversations.map(toChatShareRecipient));
    } catch {
      setRecipientError(true);
      setShareRecipients([]);
    }
  }, []);

  useEffect(() => {
    targetGeneration.current += 1;
    setSelectedChatIds([]);
    setShareRecipients([]);
    nonces.current.clear();
    if (activeReview) {
      void loadChatConversations();
    }
  }, [activeReview, loadChatConversations, accountId]);

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

    if (sending.current) return;
    sending.current = true;
    const target = activeReview;
    const generation = getAccountGeneration();
    const targetId = targetGeneration.current;
    try {
      const outcomes = await Promise.allSettled(
        selectedChatIds.map((conversationId) => {
          const key = `${target.reviewId}:${conversationId}`;
          const clientNonce = nonces.current.get(key) ?? createClientReviewId();
          nonces.current.set(key, clientNonce);
          return getHungryService().chat.sendMessage({
            conversationId,
            body: `${target.message}\n${target.link}`,
            clientNonce,
          });
        }),
      );
      if (generation !== getAccountGeneration() || targetId !== targetGeneration.current) return;
      const failed = selectedChatIds.filter((_, index) => outcomes[index].status === "rejected");
      setSelectedChatIds(failed);
      if (failed.length) {
        showToast({
          message: `${outcomes.length - failed.length} sent; ${failed.length} failed. Retry the selected recipients.`,
          tone: "warning",
        });
      } else {
        showToast({ message: `${subjectTitle} link sent.`, tone: "success" });
        innerRef.current?.dismiss();
      }
    } finally {
      sending.current = false;
    }
  }, [activeReview, innerRef, selectedChatIds, showToast]);

  const copyLink = useCallback(() => {
    if (!activeReview) return;
    Clipboard.setString(withShareSource(activeReview.link, "copy_link"));
    if (subjectLabel === "dish")
      trackAnalyticsEvent("dish_shared", {
        review_id: activeReview.reviewId,
        channel: "copy_link",
      });
    showToast({ message: `${subjectTitle} link copied.`, tone: "success" });
  }, [activeReview, showToast]);

  const shareOutsideHungry = useCallback(async () => {
    if (!activeReview) return;
    const link = withShareSource(activeReview.link, "system_share");
    let result;
    try {
      result = await Share.share({ message: `${activeReview.message}\n${link}`, url: link });
    } catch {
      showToast({ message: "Could not open sharing. Try again.", tone: "warning" });
      return;
    }
    if (result.action === Share.sharedAction) {
      if (subjectLabel === "dish")
        trackAnalyticsEvent("dish_shared", {
          review_id: activeReview.reviewId,
          channel: "system_share",
        });
    }
  }, [activeReview, showToast]);

  const shareToMessagingApp = useCallback(
    async (channel: "whatsapp" | "telegram") => {
      if (!activeReview) return;
      const link = withShareSource(activeReview.link, channel);
      const opened = await openTrustedMessagingShareUrl(
        channel === "whatsapp"
          ? buildWhatsAppShareUrl(activeReview.message, link)
          : buildTelegramShareUrl(activeReview.message, link),
      );
      if (!opened) return;
      if (subjectLabel === "dish")
        trackAnalyticsEvent("dish_shared", { review_id: activeReview.reviewId, channel });
    },
    [activeReview],
  );

  return (
    <>
      <BottomSheetModal
        ref={innerRef}
        snapPoints={snapPoints}
        index={0}
        enablePanDownToClose
        accessibilityLabel={`Share ${subjectLabel}`}
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
            accessibilityHint="Dismisses the dish sharing sheet"
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
                    accessibilityLabel={`Send ${subjectLabel} link`}
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
            {recipientError ? (
              <>
                <AppText>Couldn’t load recipients.</AppText>
                <Button label="Retry recipients" onPress={() => void loadChatConversations()} />
              </>
            ) : null}
            <InAppShareCard
              title={`Share ${subjectLabel}${directMessagesEnabled ? "" : " link"}`}
              quickActions={[
                {
                  key: "copy",
                  label: "Copy link",
                  accessibilityLabel: `Copy ${subjectLabel} link`,
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
                  accessibilityLabel: `Share ${subjectLabel} to another app`,
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
