import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";

import { AppText, BottomSheet, Button } from "@/components/ui";
import { useUIStore, type SafetyReportReason } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Step = "menu" | "report" | "block";

const REPORT_REASONS: { reason: SafetyReportReason; label: string }[] = [
  { reason: "spam", label: "Spam or an advert" },
  { reason: "offensive", label: "Offensive or unsafe" },
  { reason: "wrong_place", label: "Wrong place or dish" },
  { reason: "other", label: "Something else" },
];

/**
 * One app-wide sheet for the report / hide / block choices on a post or comment. It
 * replaces the system alert, which Android caps at three buttons and so dropped the
 * fourth action. Reporting asks for a reason; blocking asks to confirm first.
 */
export function SafetyActionsSheet() {
  const { spacing } = useHungryTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const menu = useUIStore((state) => state.safetyMenu);
  const [step, setStep] = useState<Step>("menu");

  useEffect(() => {
    if (menu) {
      setStep("menu");
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [menu]);

  const close = () => sheetRef.current?.dismiss();
  const handleDismiss = () => useUIStore.getState().closeSafetyMenu();
  // Run the choice after the sheet starts closing, so a follow-up alert is not covered by it.
  const finish = (action: () => void) => {
    close();
    action();
  };

  const label = menu?.label ?? "post";
  const authorName = menu?.authorName ?? "this user";
  // Someone else's content (nothing to hide): the sheet says what it offers, not "Manage".
  const title = menu?.canHide
    ? `Manage ${label}`
    : menu?.canBlock
      ? "Report or block"
      : `Report this ${label}`;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["52%"]}
      accessibilityLabel={title}
      onDismiss={handleDismiss}
    >
      <View style={{ gap: spacing[3] }}>
        {step === "menu" ? (
          <>
            <AppText variant="h3" accessibilityRole="header">
              {title}
            </AppText>
            <Button
              label={`Report this ${label}`}
              variant="secondary"
              onPress={() => setStep("report")}
            />
            {menu?.canHide ? (
              <Button
                label={`Hide this ${label}`}
                variant="secondary"
                onPress={() => menu && finish(menu.onHide)}
              />
            ) : null}
            {menu?.canBlock ? (
              <Button
                label={`Block ${authorName}`}
                variant="destructive"
                onPress={() => setStep("block")}
              />
            ) : null}
            <Button label="Cancel" variant="ghost" onPress={close} />
          </>
        ) : null}
        {step === "report" ? (
          <>
            <AppText variant="h3" accessibilityRole="header">
              {`Why are you reporting this ${label}?`}
            </AppText>
            {REPORT_REASONS.map((entry) => (
              <Button
                key={entry.reason}
                label={entry.label}
                variant="secondary"
                onPress={() => menu && finish(() => menu.onReport(entry.reason))}
              />
            ))}
            <Button label="Back" variant="ghost" onPress={() => setStep("menu")} />
          </>
        ) : null}
        {step === "block" ? (
          <>
            <AppText variant="h3" accessibilityRole="header">
              {`Block ${authorName}?`}
            </AppText>
            <AppText tone="secondary">
              {`You won't see posts or comments from ${authorName}, and they will stop following you. You can unblock them in Settings.`}
            </AppText>
            <Button
              label="Block"
              variant="destructive"
              onPress={() => menu && finish(menu.onBlock)}
            />
            <Button label="Back" variant="ghost" onPress={() => setStep("menu")} />
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
