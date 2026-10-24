import { useCallback } from "react";
import { Pressable } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { Flag } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText } from "@/components/ui";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import type { PendingRoute } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

interface ReportProblemLinkProps {
  venueId: string;
  /** Set on the dish page: the report is about this dish. */
  dishId?: string;
  /** The dish or stall name, shown on the report page. */
  subjectName?: string;
  /** Where a guest returns to after signing in. */
  returnRoute: PendingRoute;
}

/**
 * "Something wrong?" at the bottom of a stall or dish page. Catalog data is imported, so
 * prices and hours go stale; a tap opens the report page, which sends it to the ops queue.
 */
export function ReportProblemLink({
  venueId,
  dishId,
  subjectName,
  returnRoute,
}: ReportProblemLinkProps) {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const requireAccount = useRequireAccount();
  const subject = dishId ? "this dish" : "this stall";

  const open = useCallback(() => {
    if (!requireAccount(`Sign in to report a problem with ${subject}`, returnRoute)) return;
    navigation.navigate("ReportProblem", { venueId, dishId, subjectName });
  }, [dishId, navigation, requireAccount, returnRoute, subject, subjectName, venueId]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Report a problem with ${subject}`}
      accessibilityHint="Opens a page to tell us what's wrong"
      onPress={open}
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "center",
        flexDirection: "row",
        gap: spacing[2],
        minHeight: 44,
        opacity: pressed ? 0.7 : 1,
        paddingHorizontal: spacing[3],
      })}
    >
      <Flag color={palette.textSecondary} size={16} />
      <AppText variant="bodySmall" tone="secondary">
        Something wrong? Tell us
      </AppText>
    </Pressable>
  );
}
