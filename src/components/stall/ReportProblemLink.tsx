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
  /**
   * Not used: after sign-in a guest goes straight on to the report page instead of back to
   * this stall or dish. Kept so existing callers still type-check.
   */
  returnRoute?: PendingRoute;
}

/**
 * "Something wrong?" at the bottom of a stall or dish page. Catalog data is imported, so
 * prices and hours go stale; a tap opens the report page, which sends it to the ops queue.
 */
export function ReportProblemLink({ venueId, dishId, subjectName }: ReportProblemLinkProps) {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const requireAccount = useRequireAccount();
  const subject = dishId ? "this dish" : "this stall";

  const open = useCallback(() => {
    const params = { venueId, dishId, subjectName };
    // After sign-in the guest lands on the report page, not back on the stall or dish.
    if (
      !requireAccount(`Sign in to report a problem with ${subject}`, {
        name: "ReportProblem",
        params,
      })
    ) {
      return;
    }
    navigation.navigate("ReportProblem", params);
  }, [dishId, navigation, requireAccount, subject, subjectName, venueId]);

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
