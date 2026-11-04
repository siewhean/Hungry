/**
 * ReviewShareCard
 * The artwork of a review share card, in five templates. It is drawn `width` points wide and
 * every size scales from a 360-point layout, so the same card works as a small preview and as
 * the full-size view the picture is taken from.
 *
 * Card colours are fixed (they do not follow dark mode): a shared picture must look the same on
 * every phone. Images never fade in, so a picture taken right after a photo loads is complete.
 */
import { Text, View, type TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Star } from "lucide-react-native";

import { AccessibleImage } from "@/components/ui/AccessibleImage";
import { AppSymbol } from "@/components/ui/AppSymbol";
import { HUNGRY_LOGO_ICON, HUNGRY_LOGO_TEXT } from "@/constants/brandAssets";
import {
  REVIEW_CARD_BASE_WIDTH,
  REVIEW_CARD_TEMPLATES,
  reviewCardHeight,
  type ReviewCardModel,
  type ReviewCardSize,
  type ReviewCardTemplate,
} from "@/features/share/reviewCardModel";
import { colors } from "@/theme/tokens";

const brand = colors.light;
const INK = brand.navy;
const PAPER = "#FFFDF8";
const WEB_ADDRESS = "usehungry.com";
/** The wordmark image is about 3.2 times as wide as it is tall. */
const WORDMARK_RATIO = 2000 / 627;

const FONT = {
  display: "Fraunces_900Black",
  displayBold: "Fraunces_700Bold",
  body: "Nunito_400Regular",
  bodySemi: "Nunito_600SemiBold",
  bodyBold: "Nunito_700Bold",
  /** The order chit is set in Nunito, the price face; the app keeps mono type for code only. */
  chit: "Nunito_500Medium",
} as const;

export interface ReviewShareCardProps {
  model: ReviewCardModel;
  template: ReviewCardTemplate;
  size: ReviewCardSize;
  /** Width in points; the height follows the size. */
  width?: number;
  /** Print the review's words (people may share the rating without them). */
  showQuote?: boolean;
  /** Called once the review photo has loaded or failed, so a picture is never taken half-drawn. */
  onPhotoSettled?: () => void;
  testID?: string;
}

function Stars({ rating, size, emptyColor }: { rating: number; size: number; emptyColor: string }) {
  return (
    <View style={{ flexDirection: "row", gap: size * 0.15 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <AppSymbol
          key={index}
          name={index < rating ? "star.fill" : "star"}
          fallback={Star}
          filled={index < rating}
          size={size}
          color={index < rating ? brand.starFill : emptyColor}
        />
      ))}
    </View>
  );
}

function Wordmark({ height, color }: { height: number; color: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: height * 0.25 }}>
      <AccessibleImage
        decorative
        source={HUNGRY_LOGO_ICON}
        transition={0}
        style={{ height: height * 1.15, width: height * 1.15 }}
      />
      <AccessibleImage
        decorative
        source={HUNGRY_LOGO_TEXT}
        transition={0}
        contentFit="contain"
        style={{ height, tintColor: color, width: height * WORDMARK_RATIO }}
      />
    </View>
  );
}

function Footer({
  model,
  u,
  color,
  mutedColor,
}: {
  model: ReviewCardModel;
  u: number;
  color: string;
  mutedColor: string;
}) {
  return (
    <View
      style={{
        alignItems: "flex-end",
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 8 * u,
      }}
    >
      <View style={{ flex: 1, gap: 2 * u }}>
        <Text numberOfLines={1} style={{ color, fontFamily: FONT.bodyBold, fontSize: 13 * u }}>
          {model.authorName}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: mutedColor, fontFamily: FONT.body, fontSize: 12 * u }}
        >
          {model.dateLabel}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3 * u }}>
        <Wordmark height={16 * u} color={color} />
        <Text style={{ color: mutedColor, fontFamily: FONT.body, fontSize: 11 * u }}>
          {WEB_ADDRESS}
        </Text>
      </View>
    </View>
  );
}

function ReviewPhoto({
  uri,
  style,
  onSettled,
}: {
  uri: string;
  style: object;
  onSettled?: () => void;
}) {
  return (
    <AccessibleImage
      decorative
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={0}
      onLoadEnd={onSettled}
    />
  );
}

function PhotoTemplate({ model, u, showQuote, onPhotoSettled }: TemplateProps) {
  const white = brand.white;
  return (
    <View style={{ backgroundColor: INK, flex: 1, justifyContent: "flex-end" }}>
      {model.photoUrl ? (
        <ReviewPhoto
          uri={model.photoUrl}
          onSettled={onPhotoSettled}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />
      ) : null}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.82)"]}
        locations={[0, 0.4, 1]}
        style={{ bottom: 0, height: "58%", left: 0, position: "absolute", right: 0 }}
      />
      <View style={{ gap: 10 * u, padding: 24 * u }}>
        <Stars rating={model.rating} size={20 * u} emptyColor="rgba(255,255,255,0.45)" />
        <Text
          numberOfLines={3}
          style={{ color: white, fontFamily: FONT.display, fontSize: 36 * u, lineHeight: 39 * u }}
        >
          {model.dishName}
        </Text>
        {model.venueName ? (
          <Text
            numberOfLines={2}
            style={{ color: "rgba(255,255,255,0.9)", fontFamily: FONT.bodySemi, fontSize: 15 * u }}
          >
            {model.venueName}
          </Text>
        ) : null}
        {showQuote && model.quote ? (
          <Text
            numberOfLines={4}
            style={{ color: white, fontFamily: FONT.body, fontSize: 15 * u, lineHeight: 21 * u }}
          >
            {`“${model.quote}”`}
          </Text>
        ) : null}
        <View style={{ height: 6 * u }} />
        <Footer model={model} u={u} color={white} mutedColor="rgba(255,255,255,0.78)" />
      </View>
    </View>
  );
}

function SnapshotTemplate({ model, u, height, showQuote, onPhotoSettled }: TemplateProps) {
  const photoHeight = height * 0.46;
  return (
    <View style={{ backgroundColor: brand.passportPage, flex: 1, gap: 18 * u, padding: 28 * u }}>
      <View
        style={{
          backgroundColor: brand.white,
          borderRadius: 4 * u,
          elevation: 4,
          padding: 12 * u,
          paddingBottom: 14 * u,
          shadowColor: brand.passportInk,
          shadowOffset: { width: 0, height: 4 * u },
          shadowOpacity: 0.22,
          shadowRadius: 10 * u,
          transform: [{ rotate: "-2deg" }],
          gap: 12 * u,
        }}
      >
        {model.photoUrl ? (
          <ReviewPhoto
            uri={model.photoUrl}
            onSettled={onPhotoSettled}
            style={{
              backgroundColor: brand.bgSoft,
              borderRadius: 2 * u,
              height: photoHeight,
              width: "100%",
            }}
          />
        ) : null}
        <Text
          numberOfLines={2}
          style={{ color: INK, fontFamily: FONT.displayBold, fontSize: 24 * u, lineHeight: 28 * u }}
        >
          {model.dishName}
        </Text>
      </View>
      <View style={{ gap: 8 * u }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: 10 * u,
            justifyContent: "space-between",
          }}
        >
          <Text
            numberOfLines={2}
            style={{
              color: brand.textSecondary,
              flex: 1,
              fontFamily: FONT.bodySemi,
              fontSize: 15 * u,
            }}
          >
            {model.venueName}
          </Text>
          <Stars rating={model.rating} size={18 * u} emptyColor={brand.border} />
        </View>
        {showQuote && model.quote ? (
          <Text
            numberOfLines={4}
            style={{
              color: brand.textSecondary,
              fontFamily: FONT.body,
              fontSize: 15 * u,
              lineHeight: 22 * u,
            }}
          >
            {`“${model.quote}”`}
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1 }} />
      <Footer model={model} u={u} color={brand.passportInk} mutedColor={brand.passportInk} />
    </View>
  );
}

function ChitRule({ u }: { u: number }) {
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="clip"
      style={{ color: "#9AA6B4", fontFamily: FONT.chit, fontSize: 13 * u }}
    >
      {"- ".repeat(40)}
    </Text>
  );
}

function ChitLine({
  label,
  value,
  u,
  valueStyle,
}: {
  label: string;
  value: string;
  u: number;
  valueStyle?: TextStyle;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 12 * u, justifyContent: "space-between" }}>
      <Text
        numberOfLines={2}
        style={{
          color: INK,
          flexShrink: 1,
          fontFamily: FONT.chit,
          fontSize: 14 * u,
          lineHeight: 20 * u,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={[
          {
            color: INK,
            flexShrink: 1,
            fontFamily: FONT.chit,
            fontSize: 14 * u,
            lineHeight: 20 * u,
            textAlign: "right",
          },
          valueStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function ChitTemplate({ model, u, showQuote }: TemplateProps) {
  const toothSize = 12 * u;
  const teeth = Math.ceil((REVIEW_CARD_BASE_WIDTH - 48) / 12) + 1;
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: brand.orange,
        flex: 1,
        gap: 18 * u,
        justifyContent: "center",
        padding: 24 * u,
      }}
    >
      <View style={{ width: "100%" }}>
        <View
          style={{
            backgroundColor: PAPER,
            gap: 8 * u,
            paddingHorizontal: 20 * u,
            paddingVertical: 22 * u,
          }}
        >
          <View style={{ alignItems: "center", gap: 6 * u }}>
            <Wordmark height={22 * u} color={INK} />
            <Text style={{ color: brand.textMuted, fontFamily: FONT.chit, fontSize: 12 * u }}>
              {`ORDER CHIT  ${model.dateLabel.toUpperCase()}`}
            </Text>
          </View>
          <ChitRule u={u} />
          <ChitLine
            u={u}
            label={model.dishName}
            value={`${model.rating} / 5`}
            valueStyle={{ fontFamily: FONT.bodyBold, fontSize: 16 * u }}
          />
          {model.venueName ? <ChitLine u={u} label="Stall" value={model.venueName} /> : null}
          <ChitRule u={u} />
          {model.tags.length > 0 ? (
            model.tags.map((tag) => <ChitLine key={tag} u={u} label={tag} value="x1" />)
          ) : (
            <ChitLine u={u} label="Taste notes" value="-" />
          )}
          {showQuote && model.quote ? (
            <>
              <ChitRule u={u} />
              <Text
                numberOfLines={4}
                style={{ color: INK, fontFamily: FONT.chit, fontSize: 13 * u, lineHeight: 19 * u }}
              >
                {`NOTE: ${model.quote}`}
              </Text>
            </>
          ) : null}
          <ChitRule u={u} />
          <ChitLine
            u={u}
            label="Verdict"
            value={model.verdict}
            valueStyle={{ fontFamily: FONT.bodyBold, fontSize: 18 * u }}
          />
          <View style={{ alignItems: "center", gap: 2 * u, paddingTop: 8 * u }}>
            <Text style={{ color: brand.textMuted, fontFamily: FONT.chit, fontSize: 12 * u }}>
              THANK YOU, COME AGAIN
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: brand.textMuted, fontFamily: FONT.chit, fontSize: 12 * u }}
            >
              {`SERVED TO ${model.authorName.toUpperCase()}`}
            </Text>
          </View>
        </View>
        {/* A torn bottom edge: orange half-circles bitten out of the paper. */}
        <View style={{ flexDirection: "row", height: toothSize / 2, overflow: "hidden" }}>
          {Array.from({ length: teeth }).map((_, index) => (
            <View
              key={index}
              style={{
                backgroundColor: PAPER,
                borderBottomLeftRadius: toothSize / 2,
                borderBottomRightRadius: toothSize / 2,
                height: toothSize / 2,
                width: toothSize,
              }}
            />
          ))}
        </View>
      </View>
      <Text style={{ color: brand.white, fontFamily: FONT.bodyBold, fontSize: 13 * u }}>
        {WEB_ADDRESS}
      </Text>
    </View>
  );
}

function quoteFontSize(quote: string, u: number, compact: boolean): number {
  const base = quote.length <= 60 ? 34 : quote.length <= 100 ? 29 : 25;
  return base * u * (compact ? 0.86 : 1);
}

function QuoteTemplate({ model, u, size, showQuote }: TemplateProps) {
  const compact = size === "post";
  // With the words hidden the dish name takes the quote's place.
  const words = showQuote && model.quote ? model.quote : model.dishName;
  const fontSize = quoteFontSize(words, u, compact);
  return (
    <View style={{ backgroundColor: INK, flex: 1, gap: 16 * u, padding: 32 * u }}>
      <Text
        style={{
          color: brand.orange,
          fontFamily: FONT.display,
          fontSize: 96 * u,
          height: 64 * u,
          lineHeight: 110 * u,
        }}
      >
        {"“"}
      </Text>
      <Text
        numberOfLines={compact ? 6 : 8}
        style={{
          color: brand.white,
          fontFamily: FONT.displayBold,
          fontSize,
          lineHeight: fontSize * 1.2,
        }}
      >
        {words}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ gap: 6 * u }}>
        <Stars rating={model.rating} size={20 * u} emptyColor="rgba(255,255,255,0.35)" />
        {words !== model.dishName ? (
          <Text
            numberOfLines={2}
            style={{ color: brand.white, fontFamily: FONT.bodyBold, fontSize: 20 * u }}
          >
            {model.dishName}
          </Text>
        ) : null}
        {model.venueName ? (
          <Text
            numberOfLines={2}
            style={{ color: "rgba(255,255,255,0.85)", fontFamily: FONT.bodySemi, fontSize: 15 * u }}
          >
            {model.venueName}
          </Text>
        ) : null}
      </View>
      <View style={{ backgroundColor: "rgba(255,255,255,0.18)", height: 1 }} />
      <Footer model={model} u={u} color={brand.white} mutedColor="rgba(255,255,255,0.72)" />
    </View>
  );
}

/**
 * Mini: a small tag in the bottom corner and nothing else, so your own photo keeps the screen.
 * No border and no panel; a soft shadow keeps the white type readable on any photo.
 */
function MiniTemplate({ model, u, size }: TemplateProps) {
  const shadow: TextStyle = {
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 * u },
    textShadowRadius: 4 * u,
  };
  return (
    <View
      style={{
        backgroundColor: "transparent",
        flex: 1,
        justifyContent: "flex-end",
        paddingBottom: (size === "story" ? 96 : 32) * u,
        paddingHorizontal: 24 * u,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 * u, maxWidth: 240 * u }}>
        <AccessibleImage
          decorative
          source={HUNGRY_LOGO_ICON}
          transition={0}
          style={{ height: 22 * u, width: 22 * u }}
        />
        <View style={{ flexShrink: 1, gap: 2 * u }}>
          <Text
            numberOfLines={2}
            style={[
              {
                color: brand.white,
                fontFamily: FONT.display,
                fontSize: 17 * u,
                lineHeight: 20 * u,
              },
              shadow,
            ]}
          >
            {model.dishName}
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 * u }}>
            <Stars rating={model.rating} size={10 * u} emptyColor="rgba(255,255,255,0.6)" />
            {model.venueName ? (
              <Text
                numberOfLines={1}
                style={[
                  {
                    color: brand.white,
                    flexShrink: 1,
                    fontFamily: FONT.bodySemi,
                    fontSize: 11 * u,
                  },
                  shadow,
                ]}
              >
                {model.venueName}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function StickerTemplate({ model, u }: TemplateProps) {
  const shadow: TextStyle = {
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 * u },
    textShadowRadius: 6 * u,
  };
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "transparent",
        flex: 1,
        gap: 12 * u,
        justifyContent: "center",
        padding: 32 * u,
      }}
    >
      <Stars rating={model.rating} size={26 * u} emptyColor="rgba(255,255,255,0.6)" />
      <Text
        numberOfLines={3}
        style={[
          {
            color: brand.white,
            fontFamily: FONT.display,
            fontSize: 40 * u,
            lineHeight: 44 * u,
            textAlign: "center",
          },
          shadow,
        ]}
      >
        {model.dishName}
      </Text>
      {model.venueName ? (
        <Text
          numberOfLines={2}
          style={[
            {
              color: brand.white,
              fontFamily: FONT.bodyBold,
              fontSize: 16 * u,
              textAlign: "center",
            },
            shadow,
          ]}
        >
          {model.venueName}
        </Text>
      ) : null}
      {model.tags.length > 0 ? (
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 * u, justifyContent: "center" }}
        >
          {model.tags.map((tag) => (
            <View
              key={tag}
              style={{
                backgroundColor: "rgba(0,0,0,0.28)",
                borderColor: "rgba(255,255,255,0.85)",
                borderRadius: 999,
                borderWidth: Math.max(1, 1.5 * u),
                paddingHorizontal: 12 * u,
                paddingVertical: 4 * u,
              }}
            >
              <Text style={{ color: brand.white, fontFamily: FONT.bodyBold, fontSize: 13 * u }}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ paddingTop: 6 * u }}>
        <Wordmark height={20 * u} color={brand.white} />
      </View>
    </View>
  );
}

interface TemplateProps {
  model: ReviewCardModel;
  u: number;
  height: number;
  size: ReviewCardSize;
  showQuote: boolean;
  onPhotoSettled?: () => void;
}

const TEMPLATE_VIEWS: Record<ReviewCardTemplate, (props: TemplateProps) => React.JSX.Element> = {
  photo: PhotoTemplate,
  snapshot: SnapshotTemplate,
  chit: ChitTemplate,
  quote: QuoteTemplate,
  mini: MiniTemplate,
  sticker: StickerTemplate,
};

export function reviewShareCardLabel(model: ReviewCardModel, template: ReviewCardTemplate): string {
  const where = model.venueName ? ` at ${model.venueName}` : "";
  return `${REVIEW_CARD_TEMPLATES[template].label} card: ${model.dishName}${where}, rated ${model.rating} out of 5`;
}

export function ReviewShareCard({
  model,
  template,
  size,
  width = REVIEW_CARD_BASE_WIDTH,
  showQuote = true,
  onPhotoSettled,
  testID,
}: ReviewShareCardProps) {
  const u = width / REVIEW_CARD_BASE_WIDTH;
  const height = reviewCardHeight(size, width);
  const Template = TEMPLATE_VIEWS[template];
  return (
    <View
      testID={testID}
      collapsable={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={reviewShareCardLabel(model, template)}
      style={{ backgroundColor: "transparent", height, overflow: "hidden", width }}
    >
      <Template
        model={model}
        u={u}
        height={height}
        size={size}
        showQuote={showQuote}
        onPhotoSettled={onPhotoSettled}
      />
    </View>
  );
}
