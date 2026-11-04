import { Dialog } from "@/components/ui";

import { answerAnalyticsConsent } from "./consent";

interface AnalyticsConsentDialogProps {
  visible: boolean;
  /** Runs after the person has answered, whichever way. */
  onAnswered?: (granted: boolean) => void;
}

/**
 * The one-time "Share usage analytics?" question (App Review 5.1.1(ii)). Both answers are plain
 * buttons of the same weight; tapping outside the box or pressing Back answers nothing, so a
 * dismissal is never counted as a yes or a no.
 */
export function AnalyticsConsentDialog({ visible, onAnswered }: AnalyticsConsentDialogProps) {
  const answer = (granted: boolean) => () => {
    void answerAnalyticsConsent(granted);
    onAnswered?.(granted);
  };
  return (
    <Dialog
      visible={visible}
      title="Help improve Hungry?"
      message="Hungry can share which screens you open and what you tap with our analytics tool (PostHog), so we can see what to fix. You can change this any time in Settings. Crash reports are still sent."
      buttons={[
        { text: "Share usage data", style: "default", onPress: answer(true) },
        { text: "Don't share", style: "default", onPress: answer(false) },
      ]}
      onClose={() => undefined}
    />
  );
}
