import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Flag } from "lucide-react-native";

import { AppText, BottomSheet, Button } from "@/components/ui";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { CatalogCorrectionKind } from "@/lib/services/types";
import type { PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

const STALL_REASONS: { kind: CatalogCorrectionKind; label: string }[] = [
  { kind: "closed", label: "This stall is closed" },
  { kind: "wrong_hours", label: "Opening hours are wrong" },
  { kind: "wrong_price", label: "A price is wrong" },
  { kind: "other", label: "Something else" },
];

const DISH_REASONS: { kind: CatalogCorrectionKind; label: string }[] = [
  { kind: "wrong_price", label: "The price is wrong" },
  { kind: "wrong_dish_info", label: "The name, photo or details are wrong" },
  { kind: "closed", label: "This stall is closed" },
  { kind: "other", label: "Something else" },
];

interface ReportProblemLinkProps {
  venueId: string;
  /** Set on the dish page: the report is about this dish. */
  dishId?: string;
  /** Where a guest returns to after signing in. */
  returnRoute: PendingRoute;
}

/**
 * "Something wrong?" at the bottom of a stall or dish page. Catalog data is imported, so
 * prices and hours go stale; a tap sends one of a few reasons into the ops queue.
 */
export function ReportProblemLink({ venueId, dishId, returnRoute }: ReportProblemLinkProps) {
  const { palette, spacing } = useHungryTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const [isSending, setIsSending] = useState(false);
  const reasons = dishId ? DISH_REASONS : STALL_REASONS;
  const subject = dishId ? "this dish" : "this stall";

  const open = useCallback(() => {
    if (!requireAccount(`Sign in to report a problem with ${subject}`, returnRoute)) return;
    sheetRef.current?.present();
  }, [requireAccount, returnRoute, subject]);

  const send = useCallback(
    async (kind: CatalogCorrectionKind) => {
      if (isSending) return;
      setIsSending(true);
      try {
        await getHungryService().supply.submitCatalogCorrection({ venueId, dishId, kind });
        sheetRef.current?.dismiss();
        showToast({ message: "Thanks, we'll check it.", tone: "success" });
      } catch (error) {
        showToast({
          message:
            error instanceof Error && error.message
              ? error.message
              : "Couldn't send your report. Please try again.",
          tone: "error",
        });
      } finally {
        setIsSending(false);
      }
    },
    [dishId, isSending, showToast, venueId],
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Report a problem with ${subject}`}
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

      <BottomSheet
        ref={sheetRef}
        snapPoints={["48%"]}
        accessibilityLabel={`Report a problem with ${subject}`}
      >
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3">What&apos;s wrong?</AppText>
          {reasons.map((reason) => (
            <Button
              key={reason.kind}
              label={reason.label}
              variant="secondary"
              disabled={isSending}
              onPress={() => void send(reason.kind)}
            />
          ))}
        </View>
      </BottomSheet>
    </>
  );
}
