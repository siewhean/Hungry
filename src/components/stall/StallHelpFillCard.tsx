import { View } from "react-native";

import { AppText, Button, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = {
  /** What the stall lacks, in the order the sentence names it: "menu", "hours", "reviews". */
  missing: readonly ("menu" | "hours" | "reviews")[];
  /** Menu photo upload (a signed-in diner on a phone); left out otherwise. */
  onAddMenuPhoto?: () => void;
  isAddingMenuPhoto?: boolean;
  /** Opens the report page with "opening hours" picked. */
  onAddHours?: () => void;
  /** Opens the review composer for this stall. */
  onWriteReview?: () => void;
};

/** "menu", "menu and reviews", "menu, hours and reviews". */
function joinParts(parts: readonly string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * One card for a stall that has nothing yet, in place of a "No menu" card, an hours line and
 * a "No reviews" card in a row. Each button asks for one thing the diner may know.
 */
export function StallHelpFillCard({
  missing,
  onAddMenuPhoto,
  isAddingMenuPhoto = false,
  onAddHours,
  onWriteReview,
}: Props) {
  const { spacing } = useHungryTheme();
  return (
    <Card testID="stall-help-fill-card" style={{ gap: spacing[4], padding: spacing[4] }}>
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h3" accessibilityRole="header">
          Help us fill this in
        </AppText>
        <AppText variant="body" tone="secondary">
          {`No ${joinParts(missing)} yet. Know this stall?`}
        </AppText>
      </View>
      <View style={{ gap: spacing[2] }}>
        {onAddMenuPhoto ? (
          <Button
            label={isAddingMenuPhoto ? "Uploading..." : "Add a menu photo"}
            variant="secondary"
            disabled={isAddingMenuPhoto}
            onPress={onAddMenuPhoto}
          />
        ) : null}
        {onAddHours ? (
          <Button label="Add opening hours" variant="secondary" onPress={onAddHours} />
        ) : null}
        {onWriteReview ? <Button label="Write the first review" onPress={onWriteReview} /> : null}
      </View>
    </Card>
  );
}
