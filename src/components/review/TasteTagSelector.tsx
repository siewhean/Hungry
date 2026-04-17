import { View } from "react-native";

import { REVIEW_TAGS } from "@/constants/taste";
import { Chip } from "../ui";

interface TasteTagSelectorProps {
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export function TasteTagSelector({ selectedTags, onToggleTag }: TasteTagSelectorProps) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {REVIEW_TAGS.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          selected={selectedTags.includes(tag)}
          onPress={() => onToggleTag(tag)}
        />
      ))}
    </View>
  );
}
