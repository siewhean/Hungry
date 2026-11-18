import { useCallback, useMemo, useState, type RefObject } from "react";
import { Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Copy, Image as ImageIcon, MessageCircle, Send, Share2 } from "lucide-react-native";

import { ReviewShareStudioModal } from "@/components/share/ReviewShareStudio";
import { ShareLinkCard } from "@/components/social";
import { buildTelegramShareUrl, buildWhatsAppShareUrl } from "@/features/share/messagingShare";
import { withShareSource } from "@/features/share/shareAttribution";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openTrustedMessagingShareUrl } from "@/lib/security/safeLinking";
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
}: ReviewShareSheetProps) {
  const { palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  // Kept apart from activeReview: the sheet closes (and clears it) before the studio opens.
  const [pictureTarget, setPictureTarget] = useState<ReviewShareTarget | null>(null);
  const kind = activeReview?.kind ?? "review";
  const kindNoun = kind === "stall" ? "stall" : kind === "dish" ? "dish" : "review";
  // The sheet holds only the link actions, so it is as tall as its content (about 150) plus the
  // home-indicator inset, with no empty band under the actions.
  const snapPoints = useMemo(() => [150 + bottomInset + 24], [bottomInset]);

  const trackShare = useCallback(
    (target: ReviewShareTarget, channel: ShareChannel) => {
      const targetKind = target.kind ?? "review";
      if (targetKind === "stall") {
        trackAnalyticsEvent("stall_shared", {
          stall_id: target.reviewId.replace(/^stall-/, ""),
          channel,
        });
      } else if (targetKind === "dish") {
        trackAnalyticsEvent("dish_shared", {
          dish_id: target.reviewId.replace(/^dish-/, ""),
          channel,
        });
      } else {
        trackAnalyticsEvent("review_shared", {
          review_id: target.reviewId,
          channel,
        });
      }
      if (target.postId) {
        onShared(target.postId, channel);
      }
      onShareCompleted?.(channel);
    },
    [onShareCompleted, onShared],
  );

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
        onDismiss={onDismiss}
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
      >
        <BottomSheetView style={{ flex: 1 }}>
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              gap: spacing[3],
              padding: spacing[4],
              paddingBottom: bottomInset,
            }}
          >
            <ShareLinkCard
              title={`Share ${kindNoun} link`}
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
