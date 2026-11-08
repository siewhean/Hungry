/**
 * FoodPortfolioShareSheet
 * Share your Food Portfolio (a 3 by 3 grid of your dish photos) or your leaderboard rank as an
 * Instagram Story picture. The preview is small; the picture is taken from a full-size copy laid
 * out off screen. A build without the picture modules shares your profile link instead.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Share, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccessibleImage, AppSymbol, AppText, Button, IconButton } from "@/components/ui";
import {
  FOOD_PORTFOLIO_CARD_BASE_WIDTH,
  FOOD_PORTFOLIO_CARD_PHOTOS,
  FOOD_PORTFOLIO_CARD_SIZE,
  foodPortfolioCardHeight,
  foodPortfolioShareMessage,
  type FoodPortfolioCardKind,
  type RankCardModel,
} from "@/features/foodPortfolio/shareCards";
import { profileShareUrl } from "@/features/share/profileShare";
import { shareCardImage } from "@/features/share/shareCardImage";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { useHungryTheme } from "@/theme";

/** A picture is taken once the photos have loaded; after this long it is taken anyway. */
const PHOTO_WAIT_MS = 4000;
const CARD_TOP = "#FF7A1A";
const CARD_BOTTOM = "#C2410C";
const CARD_TEXT = "#FFFFFF";
const CARD_TILE = "rgba(255,255,255,0.18)";

export interface FoodPortfolioCardData {
  kind: FoodPortfolioCardKind;
  ownerId: string;
  ownerName: string;
  /** Portfolio card: up to nine photo URLs. */
  photos?: string[];
  /** Portfolio card: "12 dishes · 5 stalls". */
  statLine?: string;
  /** Rank card. */
  rank?: RankCardModel | null;
}

export function FoodPortfolioShareCard({
  card,
  width = FOOD_PORTFOLIO_CARD_BASE_WIDTH,
  onPhotosSettled,
  testID,
}: {
  card: FoodPortfolioCardData;
  width?: number;
  onPhotosSettled?: () => void;
  testID?: string;
}) {
  const u = width / FOOD_PORTFOLIO_CARD_BASE_WIDTH;
  const height = foodPortfolioCardHeight(width);
  const photos = (card.photos ?? []).slice(0, FOOD_PORTFOLIO_CARD_PHOTOS);
  const settledRef = useRef(new Set<number>());
  const settle = (index: number) => {
    settledRef.current.add(index);
    if (settledRef.current.size >= photos.length) onPhotosSettled?.();
  };
  useEffect(() => {
    if (card.kind !== "portfolio" || photos.length === 0) onPhotosSettled?.();
    // Only when the card changes.
  }, [card.kind, photos.length]);

  const tile = (FOOD_PORTFOLIO_CARD_BASE_WIDTH - 48 - 8 * 2) / 3;

  return (
    <LinearGradient
      testID={testID}
      colors={[CARD_TOP, CARD_BOTTOM]}
      style={{ width, height, padding: 24 * u, justifyContent: "space-between" }}
    >
      <View style={{ gap: 4 * u }}>
        <AppText style={{ color: CARD_TEXT, fontSize: 14 * u, fontWeight: "700", opacity: 0.85 }}>
          {card.kind === "rank" ? "Hungry leaderboard" : "My Food Portfolio"}
        </AppText>
        <AppText
          numberOfLines={1}
          style={{ color: CARD_TEXT, fontSize: 26 * u, fontWeight: "800", lineHeight: 32 * u }}
        >
          {card.ownerName}
        </AppText>
      </View>

      {card.kind === "portfolio" ? (
        <View style={{ gap: 12 * u }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 * u }}>
            {Array.from({ length: FOOD_PORTFOLIO_CARD_PHOTOS }, (_, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: CARD_TILE,
                  borderRadius: 10 * u,
                  height: tile * u,
                  overflow: "hidden",
                  width: tile * u,
                }}
              >
                {photos[index] ? (
                  <AccessibleImage
                    decorative
                    source={{ uri: photos[index] }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    onLoad={() => settle(index)}
                    onError={() => settle(index)}
                  />
                ) : null}
              </View>
            ))}
          </View>
          {card.statLine ? (
            <AppText style={{ color: CARD_TEXT, fontSize: 18 * u, fontWeight: "700" }}>
              {card.statLine}
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 6 * u }}>
          <AppText
            style={{ color: CARD_TEXT, fontSize: 120 * u, fontWeight: "900", lineHeight: 132 * u }}
          >
            {card.rank?.headline ?? ""}
          </AppText>
          <AppText style={{ color: CARD_TEXT, fontSize: 24 * u, fontWeight: "800" }}>
            {card.rank ? `on the board ${card.rank.periodLabel}` : ""}
          </AppText>
          <AppText style={{ color: CARD_TEXT, fontSize: 18 * u, fontWeight: "600", opacity: 0.9 }}>
            {card.rank?.detail ?? ""}
          </AppText>
        </View>
      )}

      <AppText style={{ color: CARD_TEXT, fontSize: 14 * u, fontWeight: "700", opacity: 0.85 }}>
        usehungry.com
      </AppText>
    </LinearGradient>
  );
}

export function FoodPortfolioShareSheet({
  visible,
  card,
  onClose,
}: {
  visible: boolean;
  card: FoodPortfolioCardData;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {visible ? <FoodPortfolioShareStudio card={card} onClose={onClose} /> : null}
    </Modal>
  );
}

function FoodPortfolioShareStudio({
  card,
  onClose,
}: {
  card: FoodPortfolioCardData;
  onClose: () => void;
}) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const captureRef = useRef<View>(null);
  const [settled, setSettled] = useState(false);
  const [waitOver, setWaitOver] = useState(false);
  const [sharing, setSharing] = useState(false);
  const heading = card.kind === "rank" ? "Share your rank" : "Share your Food Portfolio";
  const previewWidth = Math.max(
    Math.min(windowWidth - spacing[8] * 2, (windowHeight * 0.6 * 1080) / 1920),
    1,
  );

  useEffect(() => {
    const timer = setTimeout(() => setWaitOver(true), PHOTO_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const shareAsLink = useCallback(async () => {
    const url = profileShareUrl(card.ownerId, "system_share");
    const message = foodPortfolioShareMessage(card.kind, card.ownerName, card.rank ?? null);
    await Share.share({ message: `${message} ${url}` });
  }, [card]);

  const share = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await shareCardImage(captureRef.current, {
        ...FOOD_PORTFOLIO_CARD_SIZE,
        format: "jpg",
        dialogTitle: heading,
      });
      if (result === "unavailable") {
        await shareAsLink();
      }
      trackAnalyticsEvent("food_portfolio_card_shared", {
        kind: card.kind,
        as: result === "shared" ? "picture" : "link",
      });
    } catch (error) {
      reportError(error, { screen: "FoodPortfolioShareSheet", action: "share_card" });
    } finally {
      setSharing(false);
    }
  }, [card.kind, heading, shareAsLink, sharing]);

  const ready = settled || waitOver;

  return (
    <View
      testID="food-portfolio-share-sheet"
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
          {heading}
        </AppText>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            card.kind === "rank"
              ? `Rank card: ${card.rank?.headline ?? ""} ${card.rank?.periodLabel ?? ""}`
              : `Food Portfolio card for ${card.ownerName}`
          }
          style={{ borderRadius: 16, overflow: "hidden" }}
        >
          <FoodPortfolioShareCard card={card} width={previewWidth} testID="food-portfolio-card" />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing[4] }}>
        <Button
          testID="food-portfolio-share-button"
          label={ready ? "Share" : "Getting your photos ready"}
          loading={sharing}
          disabled={!ready || sharing}
          leftIcon={<AppSymbol name="share" size={18} color={palette.textOnOrange} />}
          onPress={() => void share()}
        />
      </View>

      {/* The full-size card the picture is taken from: laid out off screen, never seen. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          left: -(FOOD_PORTFOLIO_CARD_BASE_WIDTH + windowWidth) * 2,
          position: "absolute",
          top: 0,
        }}
      >
        <View ref={captureRef} collapsable={false}>
          <FoodPortfolioShareCard
            card={card}
            onPhotosSettled={() => setSettled(true)}
            testID="food-portfolio-card-capture"
          />
        </View>
      </View>
    </View>
  );
}
