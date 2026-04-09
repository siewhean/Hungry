import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";

import { AppText, Badge, Button, Card, Chip } from "@/components/ui";
import { REVIEW_TAGS } from "@/constants/taste";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { ReviewScreenShell } from "./ReviewScreenShell";
import type { ReviewStackParamList } from "./ReviewStack";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewTags">;

export function ReviewTagsScreen({ navigation }: Props) {
  const tags = useReviewDraftStore((state) => state.draft.selectedTags);
  const recommend = useReviewDraftStore((state) => state.draft.recommend);
  const toggleTag = useReviewDraftStore((state) => state.toggleTag);
  const setRecommend = useReviewDraftStore((state) => state.setRecommend);

  return (
    <ReviewScreenShell
      title="Taste tags"
      subtitle="Select the notes that describe the bite and whether you would recommend it."
      step={3}
      total={5}
    >
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">How did it taste?</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {REVIEW_TAGS.map((tag) => (
              <Chip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => toggleTag(tag)} />
            ))}
          </View>
          <Badge label={recommend ? "Would recommend" : "Would not recommend"} tone={recommend ? "success" : "warning"} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Recommend" variant={recommend ? "primary" : "secondary"} onPress={() => setRecommend(!recommend)} />
            <Button label="Not this time" variant={!recommend ? "primary" : "secondary"} onPress={() => setRecommend(false)} />
          </View>
        </View>
      </Card>
      <Button label="Next: final comments" onPress={() => navigation.navigate("ReviewCompose")} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ReviewScreenShell>
  );
}
