import { View } from "react-native";
import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui";

interface ReviewProgressBarProps {
  /** Current step (1-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
}

/**
 * Thin orange progress bar + step dots indicator.
 * Per Figma V2: orange fill width based on step,
 * step dots below: filled = done, orange ring = active, grey = future.
 */
export function ReviewProgressBar({ currentStep, totalSteps }: ReviewProgressBarProps) {
  const { palette, spacing, radii } = useHungryTheme();
  const progress = currentStep / totalSteps;

  return (
    <View style={{ gap: spacing[2] }}>
      {/* Thin progress bar */}
      <View
        style={{
          height: 3,
          backgroundColor: palette.border,
          borderRadius: radii.pill,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: currentStep >= totalSteps ? "#16A34A" : palette.orange,
            borderRadius: radii.pill,
          }}
        />
      </View>

      {/* Step dots */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[2],
        }}
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isDone = step < currentStep;
          const isActive = step === currentStep;

          return (
            <View
              key={step}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isDone
                  ? palette.orange
                  : isActive
                    ? "transparent"
                    : palette.border,
                borderWidth: isActive ? 2 : 0,
                borderColor: isActive ? palette.orange : "transparent",
              }}
            />
          );
        })}
        <AppText
          variant="micro"
          style={{
            color: palette.textMuted,
            marginLeft: spacing[1],
            fontFamily: "DMMono_400Regular",
            textTransform: "uppercase",
            letterSpacing: 0.8,
            fontSize: 10,
          }}
        >
          Step {currentStep} / {totalSteps}
        </AppText>
      </View>
    </View>
  );
}
