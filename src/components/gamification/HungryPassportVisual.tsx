import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { AppText } from "@/components/ui/AppText";
import { useHungryTheme } from "@/theme";
import type { PassportCategory, UserPassportProgress } from "@/types/domain";

export const GITHUB_ORANGE = "#FB8532";

const PASSPORT_INK = "#1A2E44";
const PASSPORT_PAPER = "#FFF8EC";
const PASSPORT_GOLD = "#F5C76B";
const PASSPORT_LINE = "#E5D8C3";

const DEFAULT_STAMP_ACCENTS = [
  "#2F6F48",
  "#C7681D",
  "#C94732",
  "#6F4AA2",
  "#6B4A2D",
  "#1F4F7A",
  "#2A7780",
  "#326947",
  "#9C3434",
  "#274A78",
  "#247C7A",
];

type PassportVisualVariant = "card" | "screen";
type StampSize = "small" | "medium" | "large";

type StampMeta = {
  label: string;
  code: string;
  checkpoint: string;
  accent: string;
  rotation: string;
};

type PassportVisualEntry = {
  category: PassportCategory;
  progress?: UserPassportProgress;
  index: number;
};

type ProgressMap = Record<string, UserPassportProgress | undefined>;

interface HungryPassportVisualProps {
  categories: PassportCategory[];
  progressMap: ProgressMap;
  variant?: PassportVisualVariant;
  style?: StyleProp<ViewStyle>;
}

interface PassportStampSealProps {
  category: PassportCategory;
  progress?: UserPassportProgress;
  index?: number;
  size?: StampSize;
  style?: StyleProp<ViewStyle>;
}

const CATEGORY_STAMP_META: Record<string, Omit<StampMeta, "rotation">> = {
  "cuisine-hawker": {
    label: "Hawker Explorer",
    code: "HX",
    checkpoint: "FLAVOR GATE",
    accent: "#2F6F48",
  },
  "cuisine-chinese": {
    label: "Noodle Nomad",
    code: "NN",
    checkpoint: "TASTE TERMINAL",
    accent: "#C7681D",
  },
  "cuisine-malay": {
    label: "Spice Survivor",
    code: "SS",
    checkpoint: "BITE ENTRY",
    accent: "#C94732",
  },
  "cuisine-indian": {
    label: "Curry Trailblazer",
    code: "CT",
    checkpoint: "MASALA CONTROL",
    accent: "#A33B2C",
  },
  "cuisine-japanese": {
    label: "Ramen Rambler",
    code: "RR",
    checkpoint: "NOODLE PORT",
    accent: "#274A78",
  },
  "cuisine-western": {
    label: "Brunch Pilgrim",
    code: "BP",
    checkpoint: "FORK ARRIVAL",
    accent: "#1F4F7A",
  },
  "hood-cbd": {
    label: "CBD Lunch Pilot",
    code: "LP",
    checkpoint: "LUNCH LANE",
    accent: "#2A7780",
  },
  "hood-chinatown": {
    label: "Local Legend",
    code: "LL",
    checkpoint: "HERITAGE ENTRY",
    accent: "#274A78",
  },
  "hood-bugis": {
    label: "Night Market Hunter",
    code: "NM",
    checkpoint: "AFTER DARK",
    accent: "#326947",
  },
  "hood-tampines": {
    label: "Neighbourhood Voyager",
    code: "NV",
    checkpoint: "EAST GATE",
    accent: "#247C7A",
  },
  "hood-tiong-bahru": {
    label: "Coffee Conqueror",
    code: "CC",
    checkpoint: "CAFFEINE CONTROL",
    accent: "#6B4A2D",
  },
};

const ROTATIONS = ["-3deg", "2deg", "-1deg", "3deg", "-2deg", "1deg"];

function initialsFor(label: string) {
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getStampMeta(category: PassportCategory, index = 0): StampMeta {
  const configured = CATEGORY_STAMP_META[category.id];
  const label = configured?.label ?? category.name;
  return {
    label,
    code: configured?.code ?? initialsFor(label),
    checkpoint: configured?.checkpoint ?? "FLAVOR GATE",
    accent: configured?.accent ?? DEFAULT_STAMP_ACCENTS[index % DEFAULT_STAMP_ACCENTS.length],
    rotation: ROTATIONS[index % ROTATIONS.length],
  };
}

function splitStampLabel(label: string) {
  const words = label.toUpperCase().split(" ");
  if (words.length <= 1) return [words[0] ?? "FOOD", "STAMP"];
  return [words[0], words.slice(1).join(" ")];
}

function getTotalStamps(progressMap: ProgressMap) {
  return Object.values(progressMap).reduce(
    (sum, progress) => sum + (progress?.earnedStampThresholds.length ?? 0),
    0,
  );
}

function getTotalTried(progressMap: ProgressMap) {
  return Object.values(progressMap).reduce((sum, progress) => sum + (progress?.triedCount ?? 0), 0);
}

function sortPassportEntries(categories: PassportCategory[], progressMap: ProgressMap) {
  return categories
    .map((category, index) => ({
      category,
      progress: progressMap[category.id],
      index,
    }))
    .sort((a, b) => {
      const aEarned = a.progress?.earnedStampThresholds.length ?? 0;
      const bEarned = b.progress?.earnedStampThresholds.length ?? 0;
      const aTried = a.progress?.triedCount ?? 0;
      const bTried = b.progress?.triedCount ?? 0;
      return bEarned - aEarned || bTried - aTried || a.index - b.index;
    });
}

export function PassportStampSeal({
  category,
  progress,
  index = 0,
  size = "medium",
  style,
}: PassportStampSealProps) {
  const meta = getStampMeta(category, index);
  const earnedCount = progress?.earnedStampThresholds.length ?? 0;
  const triedCount = progress?.triedCount ?? 0;
  const isActive = earnedCount > 0 || triedCount > 0;
  const [topWord, bottomWords] = splitStampLabel(meta.label);

  const sizePx = size === "large" ? 104 : size === "medium" ? 78 : 52;
  const centerSize = size === "large" ? 34 : size === "medium" ? 26 : 18;
  const isSmall = size === "small";

  return (
    <View
      accessibilityLabel={`${meta.label} stamp`}
      accessible
      style={[
        styles.stampSeal,
        {
          borderColor: meta.accent,
          borderRadius: sizePx / 2,
          height: sizePx,
          opacity: isActive ? 1 : 0.42,
          transform: [{ rotate: meta.rotation }],
          width: sizePx,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.stampInnerRing,
          {
            borderColor: meta.accent,
            borderRadius: sizePx / 2,
          },
        ]}
      >
        <AppText
          numberOfLines={1}
          variant="micro"
          style={[
            styles.stampArcText,
            {
              color: meta.accent,
              fontSize: isSmall ? 6 : 8,
              lineHeight: isSmall ? 8 : 10,
            },
          ]}
        >
          {topWord}
        </AppText>
        <View
          style={[
            styles.stampCodeDisc,
            {
              borderColor: meta.accent,
              height: centerSize,
              width: centerSize,
            },
          ]}
        >
          <AppText
            variant="micro"
            style={{
              color: meta.accent,
              fontSize: isSmall ? 8 : 11,
              fontWeight: "800",
              letterSpacing: 0.8,
              lineHeight: isSmall ? 10 : 13,
            }}
          >
            {meta.code}
          </AppText>
        </View>
        <AppText
          numberOfLines={1}
          variant="micro"
          style={[
            styles.stampArcText,
            {
              color: meta.accent,
              fontSize: isSmall ? 6 : 8,
              lineHeight: isSmall ? 8 : 10,
            },
          ]}
        >
          {bottomWords}
        </AppText>
      </View>
    </View>
  );
}

function PassportEmblem({ color = PASSPORT_GOLD, size = 44 }: { color?: string; size?: number }) {
  return (
    <View
      style={[
        styles.emblem,
        {
          borderColor: color,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <View style={[styles.emblemAxisVertical, { backgroundColor: color }]} />
      <View style={[styles.emblemAxisHorizontal, { backgroundColor: color }]} />
      <View
        style={[
          styles.emblemOrbit,
          {
            borderColor: color,
            borderRadius: size / 2,
          },
        ]}
      />
      <View style={[styles.emblemUtensilLeft, { backgroundColor: color }]} />
      <View style={[styles.emblemUtensilRight, { borderColor: color }]} />
    </View>
  );
}

function PassportCover({
  totalStamps,
  triedTotal,
  variant,
}: {
  totalStamps: number;
  triedTotal: number;
  variant: PassportVisualVariant;
}) {
  const isScreen = variant === "screen";
  return (
    <View
      style={[
        styles.cover,
        {
          height: isScreen ? 232 : 136,
          width: isScreen ? 150 : 96,
        },
      ]}
    >
      <View style={styles.coverBorder}>
        <AppText
          variant="bodyBold"
          style={[
            styles.coverTitle,
            {
              fontSize: isScreen ? 21 : 15,
              lineHeight: isScreen ? 26 : 19,
            },
          ]}
        >
          HUNGRY{"\n"}PASSPORT
        </AppText>

        <PassportEmblem size={isScreen ? 48 : 34} />

        <AppText
          variant="micro"
          style={[
            styles.coverTagline,
            {
              fontSize: isScreen ? 9 : 7,
              lineHeight: isScreen ? 13 : 10,
            },
          ]}
        >
          EXPLORE. TASTE.{"\n"}COLLECT.
        </AppText>

        <View style={styles.coverStats}>
          <AppText variant="micro" style={styles.coverStatsText}>
            {totalStamps} STAMPS
          </AppText>
          <View style={styles.coverStatsDivider} />
          <AppText variant="micro" style={styles.coverStatsText}>
            {triedTotal} TRIES
          </AppText>
        </View>
      </View>
    </View>
  );
}

function SecurityPattern() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.securityCircle, { left: "18%", top: "14%" }]} />
      <View style={[styles.securityCircle, { right: "8%", bottom: "16%" }]} />
      <View style={[styles.securityLine, { top: "28%" }]} />
      <View style={[styles.securityLine, { top: "58%" }]} />
      <View style={[styles.securityLine, { top: "82%" }]} />
    </View>
  );
}

function TravelStyleChip({ label }: { label: string }) {
  return (
    <View style={styles.travelChip}>
      <View style={styles.travelChipIcon} />
      <AppText variant="micro" style={styles.travelChipText}>
        {label}
      </AppText>
    </View>
  );
}

function PassportSpread({
  entries,
  totalStamps,
  variant,
}: {
  entries: PassportVisualEntry[];
  totalStamps: number;
  variant: PassportVisualVariant;
}) {
  const isScreen = variant === "screen";
  const shownEntries = entries.slice(0, isScreen ? 4 : 3);

  return (
    <View
      style={[
        styles.spread,
        {
          minHeight: isScreen ? 232 : 136,
        },
      ]}
    >
      <View style={[styles.passportPage, styles.identityPage]}>
        <SecurityPattern />
        <View style={styles.bindingStrip}>
          {["street", "local", "bold", "sweet", "coffee"].map((item) => (
            <View key={item} style={styles.bindingGlyph} />
          ))}
        </View>
        <View style={styles.pageContent}>
          <View style={styles.pageRuleRow}>
            <View style={styles.goldRule} />
            <PassportEmblem color={GITHUB_ORANGE} size={20} />
            <View style={styles.goldRule} />
          </View>
          <AppText variant="micro" style={styles.passportPageLabel}>
            HUNGRY PASSPORT
          </AppText>
          <View style={styles.ownerLine}>
            <AppText variant="micro" style={styles.ownerLabel}>
              THIS PASSPORT BELONGS TO
            </AppText>
            <View style={styles.dottedLine} />
          </View>

          <View style={styles.foodTravelerBlock}>
            <AppText variant="bodySmallBold" style={styles.foodTravelerTitle}>
              FOOD TRAVELER
            </AppText>
            <AppText variant="micro" style={styles.foodTravelerCopy}>
              Every bite is a stamp.{"\n"}Every journey is a story.
            </AppText>
          </View>

          {isScreen && (
            <View style={styles.travelStylePanel}>
              <TravelStyleChip label="STREET" />
              <TravelStyleChip label="LOCAL" />
              <TravelStyleChip label="BOLD" />
              <TravelStyleChip label="SWEET" />
            </View>
          )}

          <View style={styles.identityFooter}>
            <View style={styles.signatureBox}>
              <AppText variant="micro" style={styles.ownerLabel}>
                SIGNATURE
              </AppText>
              <View style={styles.dottedLine} />
            </View>
            <View style={styles.tasteMoreSeal}>
              <AppText variant="micro" style={styles.tasteMoreText}>
                TASTE{"\n"}MORE
              </AppText>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.passportPage, styles.achievementPage]}>
        <SecurityPattern />
        <View style={styles.pageContent}>
          <View style={styles.achievementHeader}>
            <View style={styles.goldRule} />
            <View>
              <AppText variant="bodySmallBold" style={styles.achievementsTitle}>
                ACHIEVEMENTS
              </AppText>
              <AppText variant="micro" style={styles.achievementsSubtitle}>
                COLLECT STAMPS. EARN BADGES.
              </AppText>
            </View>
            <View style={styles.goldRule} />
          </View>

          <View style={styles.stampPreviewList}>
            {shownEntries.map((entry) => {
              const progress = entry.progress;
              const earnedCount = progress?.earnedStampThresholds.length ?? 0;
              const earnedLabel =
                earnedCount > 0
                  ? `${earnedCount} earned`
                  : (progress?.triedCount ?? 0) > 0
                    ? "in progress"
                    : "stamp here";

              return (
                <View
                  key={entry.category.id}
                  style={[
                    styles.stampPreviewRow,
                    {
                      minHeight: isScreen ? 42 : 31,
                    },
                  ]}
                >
                  <PassportStampSeal
                    category={entry.category}
                    index={entry.index}
                    progress={progress}
                    size="small"
                  />
                  <View style={styles.stampPreviewText}>
                    <AppText numberOfLines={1} variant="micro" style={styles.stampPreviewTitle}>
                      {getStampMeta(entry.category, entry.index).label.toUpperCase()}
                    </AppText>
                    <AppText numberOfLines={1} variant="micro" style={styles.stampPreviewMeta}>
                      {earnedLabel.toUpperCase()}
                    </AppText>
                  </View>
                  {isScreen && (
                    <View style={styles.stampHereBox}>
                      <AppText variant="micro" style={styles.stampHereText}>
                        STAMP{"\n"}HERE
                      </AppText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.pageNumberRow}>
            <View style={styles.pageDash} />
            <AppText variant="micro" style={styles.pageNumberText}>
              {totalStamps.toString().padStart(2, "0")}
            </AppText>
            <View style={styles.pageDash} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function HungryPassportVisual({
  categories,
  progressMap,
  variant = "card",
  style,
}: HungryPassportVisualProps) {
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const totalStamps = getTotalStamps(progressMap);
  const triedTotal = getTotalTried(progressMap);
  const sortedEntries = sortPassportEntries(categories, progressMap);
  const activeEntries = sortedEntries.filter(
    (entry) =>
      (entry.progress?.triedCount ?? 0) > 0 ||
      (entry.progress?.earnedStampThresholds.length ?? 0) > 0,
  );
  const featuredEntries = activeEntries.length > 0 ? activeEntries : sortedEntries;

  const isScreen = variant === "screen";

  return (
    <View
      style={[
        shadows.card,
        styles.visualShell,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.xl,
          padding: isScreen ? spacing[4] : spacing[3],
        },
        style,
      ]}
    >
      {isScreen && (
        <View style={styles.brandHeader}>
          <PassportEmblem color={GITHUB_ORANGE} size={36} />
          <AppText variant="displaySm" style={styles.brandTitle}>
            Hungry Passport
          </AppText>
          <AppText variant="micro" style={styles.brandSubtitle}>
            EXPLORE. TASTE. COLLECT. SAVOR THE JOURNEY.
          </AppText>
        </View>
      )}

      <View
        style={[
          styles.passportScene,
          {
            gap: isScreen ? spacing[3] : spacing[2],
          },
        ]}
      >
        <PassportCover totalStamps={totalStamps} triedTotal={triedTotal} variant={variant} />
        <PassportSpread entries={featuredEntries} totalStamps={totalStamps} variant={variant} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  achievementHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  achievementPage: {
    borderLeftWidth: 0,
  },
  achievementsSubtitle: {
    color: PASSPORT_INK,
    fontSize: 7,
    letterSpacing: 0.4,
    lineHeight: 9,
    opacity: 0.7,
    textAlign: "center",
  },
  achievementsTitle: {
    color: PASSPORT_INK,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 14,
    textAlign: "center",
  },
  bindingGlyph: {
    backgroundColor: PASSPORT_GOLD,
    borderRadius: 4,
    height: 9,
    opacity: 0.6,
    width: 9,
  },
  bindingStrip: {
    alignItems: "center",
    backgroundColor: PASSPORT_INK,
    bottom: 0,
    gap: 11,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    top: 0,
    width: 20,
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  brandSubtitle: {
    color: GITHUB_ORANGE,
    letterSpacing: 1.1,
    marginTop: 2,
    textAlign: "center",
  },
  brandTitle: {
    color: GITHUB_ORANGE,
    letterSpacing: 1.3,
    marginTop: 6,
    textAlign: "center",
    textTransform: "uppercase",
  },
  cover: {
    backgroundColor: GITHUB_ORANGE,
    borderRadius: 18,
    padding: 8,
    shadowColor: PASSPORT_INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  coverBorder: {
    alignItems: "center",
    borderColor: "rgba(255, 248, 220, 0.82)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 7,
    paddingVertical: 12,
  },
  coverStats: {
    alignItems: "center",
    backgroundColor: "rgba(255, 248, 220, 0.2)",
    borderColor: "rgba(255, 248, 220, 0.5)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverStatsDivider: {
    backgroundColor: "rgba(255, 248, 220, 0.66)",
    height: 10,
    width: 1,
  },
  coverStatsText: {
    color: "#FFF6D6",
    fontSize: 6,
    letterSpacing: 0.7,
    lineHeight: 8,
  },
  coverTagline: {
    color: "#FFF6D6",
    letterSpacing: 1,
    textAlign: "center",
  },
  coverTitle: {
    color: "#FFF6D6",
    fontFamily: "Fraunces_700Bold",
    letterSpacing: 1.1,
    textAlign: "center",
    textTransform: "uppercase",
  },
  dottedLine: {
    borderBottomColor: PASSPORT_INK,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
    opacity: 0.4,
  },
  emblem: {
    alignItems: "center",
    borderWidth: 1.5,
    justifyContent: "center",
  },
  emblemAxisHorizontal: {
    height: 1,
    position: "absolute",
    width: "118%",
  },
  emblemAxisVertical: {
    height: "118%",
    position: "absolute",
    width: 1,
  },
  emblemOrbit: {
    borderWidth: 1,
    height: "62%",
    position: "absolute",
    transform: [{ rotate: "26deg" }],
    width: "82%",
  },
  emblemUtensilLeft: {
    borderRadius: 4,
    height: "70%",
    left: -7,
    position: "absolute",
    width: 2,
  },
  emblemUtensilRight: {
    borderRadius: 999,
    borderWidth: 2,
    height: "46%",
    position: "absolute",
    right: -8,
    width: 8,
  },
  foodTravelerBlock: {
    marginTop: 10,
  },
  foodTravelerCopy: {
    color: PASSPORT_INK,
    fontSize: 8,
    lineHeight: 11,
    opacity: 0.7,
    textAlign: "center",
  },
  foodTravelerTitle: {
    color: PASSPORT_INK,
    fontSize: 12,
    letterSpacing: 0.8,
    textAlign: "center",
  },
  goldRule: {
    backgroundColor: PASSPORT_GOLD,
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  identityFooter: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    marginTop: "auto",
  },
  identityPage: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingLeft: 20,
  },
  ownerLabel: {
    color: PASSPORT_INK,
    fontSize: 6.5,
    letterSpacing: 0.5,
    lineHeight: 9,
    opacity: 0.65,
  },
  ownerLine: {
    gap: 5,
    marginTop: 10,
  },
  pageContent: {
    flex: 1,
    padding: 10,
  },
  pageDash: {
    backgroundColor: PASSPORT_LINE,
    height: 1,
    width: 18,
  },
  pageNumberRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    marginTop: "auto",
  },
  pageNumberText: {
    color: PASSPORT_INK,
    fontSize: 7,
    letterSpacing: 0.7,
    opacity: 0.6,
  },
  pageRuleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  passportPage: {
    backgroundColor: PASSPORT_PAPER,
    borderColor: PASSPORT_LINE,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: "hidden",
  },
  passportPageLabel: {
    color: PASSPORT_INK,
    fontSize: 8,
    letterSpacing: 0.6,
    marginTop: 6,
    textAlign: "center",
  },
  passportScene: {
    alignItems: "stretch",
    flexDirection: "row",
  },
  securityCircle: {
    borderColor: "#E8D7BE",
    borderRadius: 60,
    borderWidth: 1,
    height: 96,
    opacity: 0.42,
    position: "absolute",
    width: 96,
  },
  securityLine: {
    backgroundColor: "#E8D7BE",
    height: StyleSheet.hairlineWidth,
    left: 12,
    opacity: 0.7,
    position: "absolute",
    right: 12,
  },
  signatureBox: {
    borderColor: PASSPORT_LINE,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 32,
    padding: 6,
  },
  spread: {
    borderRadius: 18,
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: PASSPORT_INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
  },
  stampArcText: {
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  stampCodeDisc: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  stampHereBox: {
    alignItems: "center",
    borderColor: PASSPORT_LINE,
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    width: 42,
  },
  stampHereText: {
    color: PASSPORT_INK,
    fontSize: 6,
    letterSpacing: 0.5,
    lineHeight: 8,
    opacity: 0.45,
    textAlign: "center",
  },
  stampInnerRing: {
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    flex: 1,
    justifyContent: "space-evenly",
    margin: 4,
  },
  stampPreviewList: {
    gap: 6,
    marginTop: 10,
  },
  stampPreviewMeta: {
    color: PASSPORT_INK,
    fontSize: 6,
    letterSpacing: 0.6,
    lineHeight: 8,
    opacity: 0.55,
  },
  stampPreviewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  stampPreviewText: {
    flex: 1,
  },
  stampPreviewTitle: {
    color: PASSPORT_INK,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.5,
    lineHeight: 9,
  },
  stampSeal: {
    backgroundColor: "rgba(255, 248, 236, 0.84)",
    borderStyle: "dashed",
    borderWidth: 1.6,
    padding: 2,
  },
  tasteMoreSeal: {
    alignItems: "center",
    borderColor: PASSPORT_INK,
    borderRadius: 999,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    opacity: 0.72,
    width: 34,
  },
  tasteMoreText: {
    color: PASSPORT_INK,
    fontSize: 6,
    letterSpacing: 0.5,
    lineHeight: 8,
    textAlign: "center",
  },
  travelChip: {
    alignItems: "center",
    gap: 3,
  },
  travelChipIcon: {
    backgroundColor: GITHUB_ORANGE,
    borderRadius: 5,
    height: 10,
    opacity: 0.7,
    width: 10,
  },
  travelChipText: {
    color: PASSPORT_INK,
    fontSize: 6,
    letterSpacing: 0.4,
    lineHeight: 8,
  },
  travelStylePanel: {
    borderColor: PASSPORT_LINE,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    padding: 7,
  },
  visualShell: {
    borderWidth: 1,
  },
});
