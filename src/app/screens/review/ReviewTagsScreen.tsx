import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { ThumbsDown, ThumbsUp } from "lucide-react-native";

import { AppText, Badge, Button, Card, Chip } from "@/components/ui";
import { REVIEW_TAGS } from "@/constants/taste";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useHungryTheme } from "@/theme";
import { ReviewScreenShell } from "./ReviewScreenShell";
import type { ReviewStackParamList } from "./ReviewStack";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewTags">;

export function ReviewTagsScreen({ navigation, route }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const tags = useReviewDraftStore((state) => state.draft.selectedTags);
  const recommend = useReviewDraftStore((state) => state.draft.recommend);
  const toggleTag = useReviewDraftStore((state) => state.toggleTag);
  const setRecommend = useReviewDraftStore((state) => state.setRecommend);
  const { venueId, dishId } = route.params;

  return (
    <ReviewScreenShell
      title="Taste tags"
      subtitle="Select the notes that describe the bite and whether you would recommend it."
      step={3}
      total={4}
    >
      <Card>
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3">How did it taste?</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {REVIEW_TAGS.map((tag) => (
              <Chip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => toggleTag(tag)} />
            ))}
          </View>
          <Badge label={recommend ? "Would recommend" : "Would not recommend"} tone={recommend ? "success" : "warning"} />
          <View
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.orange,
              borderRadius: radii.pill,
              borderWidth: 1,
              flexDirection: "row",
              gap: spacing[2],
              padding: spacing[1],
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setRecommend(true)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: recommend ? palette.orange : "transparent",
                borderColor: recommend ? palette.orange : palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                flex: 1,
                flexDirection: "row",
                gap: spacing[2],
                justifyContent: "center",
                minHeight: 44,
                opacity: pressed ? 0.9 : 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              })}
            >
              <ThumbsUp color={recommend ? palette.surface : palette.navy} size={16} />
              <AppText variant="bodySmall" style={{ color: recommend ? palette.surface : palette.text }}>
                Recommend
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRecommend(false)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: !recommend ? palette.orange : "transparent",
                borderColor: !recommend ? palette.orange : palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                flex: 1,
                flexDirection: "row",
                gap: spacing[2],
                justifyContent: "center",
                minHeight: 44,
                opacity: pressed ? 0.9 : 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              })}
            >
              <ThumbsDown color={!recommend ? palette.surface : palette.navy} size={16} />
              <AppText variant="bodySmall" style={{ color: !recommend ? palette.surface : palette.text }}>
                Not this time
              </AppText>
            </Pressable>
          </View>
        </View>
      </Card>
      <Button label="Next: final comments" onPress={() => navigation.navigate("ReviewCompose", { venueId, dishId })} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ReviewScreenShell>
  );
}
