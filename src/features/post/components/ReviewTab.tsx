import React from "react";
import { View, StyleSheet, Switch, Pressable } from "react-native";
import { Star, Sparkles, MessageSquare } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";
import { AppText, Input, Badge } from "@/components/ui";
import { StarRating } from "@/components/review";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";
import { spacing, semanticSpacing } from "@/theme/tokens";

const HASHTAG_SUGGESTIONS = [
  "#singaporefood",
  "#hawkergems",
  "#delicious",
  "#shiok",
  "#foodreview",
  "#supportlocal",
  "#sgfoodies",
  "#musttry",
] as const;

export function ReviewTab() {
  const { componentRadii, palette } = useHungryTheme();
  const reviewCaption = useComposerStore((state) => state.reviewCaption);
  const postCaption = useComposerStore((state) => state.postCaption);
  const isMerchantMode = useMerchantStore(isMerchantModeActive);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isUserMode = !isMerchantMode && !isDeveloperMode;
  const shouldShowHashtagSuggestions = !isUserMode;
  const setCaption = useComposerStore((state) => state.setCaption);
  const rating = useComposerStore((state) => state.rating);
  const setRating = useComposerStore((state) => state.setRating);
  const useSameCaption = useComposerStore((state) => state.useSameCaption);
  const setUseSameCaption = useComposerStore((state) => state.setUseSameCaption);
  const [suggestionOffset, setSuggestionOffset] = React.useState(0);

  const remaining = 500 - reviewCaption.length;
  const visibleSuggestions = HASHTAG_SUGGESTIONS.slice(suggestionOffset, suggestionOffset + 4);
  const hashtagSuggestions =
    visibleSuggestions.length === 4
      ? visibleSuggestions
      : [...visibleSuggestions, ...HASHTAG_SUGGESTIONS.slice(0, 4 - visibleSuggestions.length)];

  const handleAddHashtag = (tag: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newCaption = reviewCaption ? `${reviewCaption} ${tag}` : tag;
    if (newCaption.length <= 500) {
      setCaption(newCaption);
    }
  };

  const handleRefreshHashtags = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSuggestionOffset((current) => (current + 4) % HASHTAG_SUGGESTIONS.length);
  };

  return (
    <View
      style={[
        styles.container,
        { padding: semanticSpacing.screenEdge, gap: semanticSpacing.sectionGap },
      ]}
    >
      {/* Rating */}
      <View style={styles.section}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: semanticSpacing.inlineGaps,
            marginBottom: semanticSpacing.componentGap,
          }}
        >
          <Star size={18} color={palette.starStroke} fill={palette.starFill} />
          <AppText variant="bodyBold">Overall Rating</AppText>
        </View>
        <StarRating value={rating} onChange={setRating} editable fullWidth />
      </View>

      {/* Caption */}
      <View style={styles.section}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: semanticSpacing.inlineGaps,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: semanticSpacing.inlineGaps }}
          >
            <MessageSquare size={18} color={palette.text} />
            <AppText variant="bodyBold">Quick Review</AppText>
          </View>
          <AppText variant="code" tone={remaining < 0 ? "accent" : "muted"}>
            {remaining}
          </AppText>
        </View>
        <Input
          multiline
          numberOfLines={6}
          maxLength={500}
          placeholder="What did you think of the food?"
          value={reviewCaption}
          onChangeText={setCaption}
          editable={!useSameCaption}
          style={{
            backgroundColor: palette.surface,
            borderRadius: componentRadii.input,
            opacity: useSameCaption ? 0.6 : 1,
            minHeight: 120,
          }}
        />

        {/* Sync Toggle - Moved below input */}
        {postCaption.length > 0 && (
          <View
            style={[
              styles.syncBar,
              {
                backgroundColor: palette.orangeLight,
                borderRadius: componentRadii.card,
                marginTop: semanticSpacing.componentGap,
                paddingHorizontal: semanticSpacing.screenEdge,
                paddingVertical: semanticSpacing.inlineGaps,
              },
            ]}
          >
            <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700", flex: 1 }}>
              USE SAME CAPTION AS POST
            </AppText>
            <Switch
              value={useSameCaption}
              onValueChange={setUseSameCaption}
              trackColor={{ false: palette.border, true: palette.orange }}
              thumbColor={palette.white}
              style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
            />
          </View>
        )}
      </View>

      {/* AI Suggestions */}
      {shouldShowHashtagSuggestions && (
        <View style={styles.section}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: semanticSpacing.inlineGaps,
              marginBottom: semanticSpacing.componentGap,
            }}
          >
            <Sparkles size={16} color={palette.orange} />
            <AppText variant="bodySmallBold">AI Hashtag Suggestions</AppText>
          </View>
          <View style={[styles.chipRow, { gap: semanticSpacing.inlineGaps }]}>
            {hashtagSuggestions.map((tag) => (
              <Pressable key={tag} onPress={() => handleAddHashtag(tag)}>
                <Badge label={tag} tone="neutral" />
              </Pressable>
            ))}
            <Pressable onPress={handleRefreshHashtags}>
              <Badge label="Refresh" tone="orange" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  syncBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  section: {
    gap: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
