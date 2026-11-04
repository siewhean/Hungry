/**
 * ReviewShareStudio
 * The share screen for your own review, Strava style: swipe through card templates, pick Story
 * or Post size, choose whether your words show, then share the card as a picture (Instagram
 * Stories, WhatsApp, Save Image ...) or copy the review link.
 *
 * The preview cards are small; the picture is taken from a full-size copy of the chosen card
 * laid out off screen, so it is sharp.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  Switch,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReviewShareCard } from "@/components/share/ReviewShareCard";
import { AppSymbol, AppText, Button, Chip, IconButton, SegmentedControl } from "@/components/ui";
import {
  REVIEW_CARD_BASE_WIDTH,
  REVIEW_CARD_SIZES,
  REVIEW_CARD_TEMPLATES,
  availableReviewCardTemplates,
  buildReviewCardModel,
  reviewCardHeight,
  reviewCardImageFormat,
  type ReviewCardInput,
  type ReviewCardSize,
  type ReviewCardTemplate,
} from "@/features/share/reviewCardModel";
import { shareLink } from "@/features/share/messagingShare";
import { withShareSource } from "@/features/share/shareAttribution";
import { shareCardImage } from "@/features/share/shareCardImage";
import { trackAnalyticsEvent } from "@/lib/analytics";
import * as Haptics from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { useHungryTheme } from "@/theme";

export type ReviewShareStudioSource = "review_page" | "review_posted";

/** A picture is taken once the photo has loaded; after this long it is taken anyway. */
const PHOTO_WAIT_MS = 4000;
const SIZE_OPTIONS = (Object.keys(REVIEW_CARD_SIZES) as ReviewCardSize[]).map((value) => ({
  value,
  label: REVIEW_CARD_SIZES[value].label,
  accessibilityLabel: `${REVIEW_CARD_SIZES[value].label} size`,
}));

export interface ReviewShareStudioProps {
  card: ReviewCardInput;
  /** The review's web link, for Copy link and the link fallback. */
  link: string;
  source: ReviewShareStudioSource;
  onClose: () => void;
}

export function ReviewShareStudio({ card, link, source, onClose }: ReviewShareStudioProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const model = useMemo(() => buildReviewCardModel(card), [card]);
  const templates = useMemo(() => availableReviewCardTemplates(model), [model]);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [size, setSize] = useState<ReviewCardSize>("story");
  const [showQuote, setShowQuote] = useState(true);
  const [previewArea, setPreviewArea] = useState<{ width: number; height: number } | null>(null);
  const [photoSettledKey, setPhotoSettledKey] = useState<string | null>(null);
  const [photoWaitOverKey, setPhotoWaitOverKey] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const pagerRef = useRef<ScrollView>(null);
  const captureRef = useRef<View>(null);

  const template: ReviewCardTemplate = templates[Math.min(templateIndex, templates.length - 1)];
  const usesPhoto = REVIEW_CARD_TEMPLATES[template].needsPhoto && Boolean(model.photoUrl);
  const captureKey = `${template}:${size}:${model.photoUrl ?? ""}`;
  const ready = !usesPhoto || photoSettledKey === captureKey || photoWaitOverKey === captureKey;
  const quoteToggleShown = Boolean(model.quote) && template !== "sticker";

  useEffect(() => {
    trackAnalyticsEvent("review_card_opened", {
      review_id: model.reviewId,
      source,
      template_count: templates.length,
      has_photo: Boolean(model.photoUrl),
    });
    // Opened once per review.
  }, [model.reviewId]);

  useEffect(() => {
    if (!usesPhoto) return undefined;
    const timer = setTimeout(() => setPhotoWaitOverKey(captureKey), PHOTO_WAIT_MS);
    return () => clearTimeout(timer);
  }, [captureKey, usesPhoto]);

  // Preview cards fit the space above the controls with room to breathe.
  const pageWidth = previewArea?.width ?? windowWidth;
  const previewWidth = useMemo(() => {
    const maxWidth = pageWidth - spacing[8] * 2;
    if (!previewArea) return Math.max(maxWidth * 0.8, 1);
    const ratio = REVIEW_CARD_SIZES[size].width / REVIEW_CARD_SIZES[size].height;
    return Math.max(Math.min(maxWidth, (previewArea.height - spacing[4]) * ratio), 1);
  }, [pageWidth, previewArea, size, spacing]);

  const handlePreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!previewArea || previewArea.width !== width || previewArea.height !== height) {
      setPreviewArea({ width, height });
    }
  };

  const selectTemplate = useCallback(
    (index: number, scroll: boolean) => {
      if (index === templateIndex) return;
      setTemplateIndex(index);
      Haptics.selectHaptic();
      if (scroll) pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    },
    [pageWidth, templateIndex],
  );

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / Math.max(pageWidth, 1));
    selectTemplate(Math.max(0, Math.min(index, templates.length - 1)), false);
  };

  const shareAsLink = useCallback(
    () =>
      shareLink(
        {
          kind: "review",
          id: model.reviewId,
          message: `I reviewed ${model.dishName}${model.venueName ? ` at ${model.venueName}` : ""} on Hungry`,
          url: link,
        },
        "system_share",
      ),
    [link, model],
  );

  const sharePicture = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const { width, height } = REVIEW_CARD_SIZES[size];
      const result = await shareCardImage(captureRef.current, {
        width,
        height,
        format: reviewCardImageFormat(template),
        dialogTitle: "Share your review",
      });
      if (result === "unavailable") {
        await shareAsLink();
        return;
      }
      trackAnalyticsEvent("review_card_shared", {
        review_id: model.reviewId,
        template,
        size,
        show_quote: quoteToggleShown ? showQuote : false,
        source,
      });
    } catch (error) {
      reportError(error, { screen: "ReviewShareStudio", action: "share_card" });
    } finally {
      setSharing(false);
    }
  }, [model.reviewId, quoteToggleShown, shareAsLink, sharing, showQuote, size, source, template]);

  const copyLink = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(withShareSource(link, "copy_link"));
      trackAnalyticsEvent("review_shared", { review_id: model.reviewId, channel: "copy_link" });
      setLinkCopied(true);
      Haptics.successHaptic();
    } catch (error) {
      reportError(error, { screen: "ReviewShareStudio", action: "copy_link" });
    }
  }, [link, model.reviewId]);

  useEffect(() => {
    if (!linkCopied) return undefined;
    const timer = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [linkCopied]);

  const previewHeight = reviewCardHeight(size, previewWidth);

  return (
    <View
      testID="review-share-studio"
      style={{
        backgroundColor: palette.bg,
        flex: 1,
        paddingBottom: insets.bottom + spacing[3],
        paddingTop: insets.top,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", paddingHorizontal: spacing[2] }}>
        <IconButton
          variant="ghost"
          accessibilityLabel="Close"
          accessibilityHint="Closes sharing without sharing"
          onPress={onClose}
          icon={<AppSymbol name="close" color={palette.text} size={20} />}
        />
        <AppText variant="h3" accessibilityRole="header" style={{ flex: 1, textAlign: "center" }}>
          Share your review
        </AppText>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ flex: 1 }} onLayout={handlePreviewLayout}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          accessibilityLabel="Card designs. Swipe to see more."
        >
          {templates.map((candidate) => (
            <View
              key={candidate}
              style={{
                alignItems: "center",
                height: previewArea?.height ?? previewHeight,
                justifyContent: "center",
                width: pageWidth,
              }}
            >
              <View
                style={{
                  borderRadius: componentRadii.card,
                  elevation: 3,
                  overflow: "hidden",
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.16,
                  shadowRadius: 16,
                }}
              >
                {candidate === "sticker" ? (
                  // A see-through card shown over a stand-in photo so the white type reads.
                  <LinearGradient
                    colors={[palette.navy, palette.orangeDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
                  />
                ) : null}
                <ReviewShareCard
                  model={model}
                  template={candidate}
                  size={size}
                  width={previewWidth}
                  showQuote={showQuote}
                  testID={`review-share-preview-${candidate}`}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[3] }}>
        <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
          {template === "sticker"
            ? "See-through: place it over your own photo in Instagram."
            : REVIEW_CARD_TEMPLATES[template].description}
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
          accessibilityRole="tablist"
        >
          {templates.map((candidate, index) => (
            <Chip
              key={candidate}
              accessibilityRole="tab"
              label={REVIEW_CARD_TEMPLATES[candidate].label}
              selected={candidate === template}
              onPress={() => selectTemplate(index, true)}
            />
          ))}
        </ScrollView>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
          <SegmentedControl
            options={SIZE_OPTIONS}
            value={size}
            onChange={setSize}
            accessibilityLabel="Card size"
            style={{ flex: 1 }}
            compact
          />
          {quoteToggleShown ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              <AppText variant="bodySmall">Show my words</AppText>
              <Switch
                accessibilityLabel="Show my words on the card"
                value={showQuote}
                onValueChange={setShowQuote}
                trackColor={{ true: palette.orange, false: palette.border }}
              />
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Button
            label={linkCopied ? "Link copied" : "Copy link"}
            variant="secondary"
            fullWidth={false}
            style={{ flex: 1 }}
            leftIcon={
              <AppSymbol name={linkCopied ? "selected" : "copy"} color={palette.text} size={18} />
            }
            onPress={copyLink}
          />
          <Button
            label="Share picture"
            fullWidth={false}
            style={{ flex: 1.4 }}
            loading={sharing}
            disabled={!ready}
            accessibilityHint="Opens the share sheet with this card as a picture"
            leftIcon={<AppSymbol name="share" color={palette.textOnOrange} size={18} />}
            onPress={() => void sharePicture()}
          />
        </View>
      </View>

      {/* The full-size card the picture is taken from: laid out off screen, never seen. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ left: -(REVIEW_CARD_BASE_WIDTH + windowWidth) * 2, position: "absolute", top: 0 }}
      >
        <View ref={captureRef} collapsable={false} style={{ backgroundColor: "transparent" }}>
          <ReviewShareCard
            key={captureKey}
            model={model}
            template={template}
            size={size}
            showQuote={showQuote}
            onPhotoSettled={() => setPhotoSettledKey(captureKey)}
            testID="review-share-capture"
          />
        </View>
      </View>
    </View>
  );
}

/** The share screen as a full-screen sheet, for pages that are not already inside a modal. */
export function ReviewShareStudioModal({
  visible,
  ...props
}: ReviewShareStudioProps & { visible: boolean }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={props.onClose}
      accessibilityViewIsModal
    >
      {visible ? <ReviewShareStudio {...props} /> : null}
    </Modal>
  );
}
