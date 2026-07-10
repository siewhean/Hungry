import { useCallback, useMemo, forwardRef, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";

import { useHungryTheme } from "@/theme";

interface BottomSheetProps extends Partial<BottomSheetModalProps> {
  children: ReactNode;
  snapPoints?: string[];
  accessibilityLabel?: string;
}

/**
 * Accessibility contract:
 * - Every sheet needs a contextual label from the caller when the default is too generic.
 * - The backdrop remains a labelled dismiss target.
 * - Native focus order must be smoke-tested because the sheet is third-party native UI.
 */
export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  (
    { children, snapPoints: customSnapPoints, accessibilityLabel = "Bottom sheet", ...props },
    ref,
  ) => {
    const { opacity, palette, spacing } = useHungryTheme();

    const defaultSnapPoints = useMemo(() => ["50%", "90%"], []);
    const snapPoints = customSnapPoints || defaultSnapPoints;

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          accessibilityRole="button"
          accessibilityLabel="Close bottom sheet"
          accessibilityHint="Dismisses the current bottom sheet"
          opacity={opacity.backdrop}
        />
      ),
      [opacity.backdrop],
    );

    return (
      <BottomSheetModal
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.surface }}
        handleIndicatorStyle={{ backgroundColor: palette.border }}
        accessibilityLabel={accessibilityLabel}
        accessibilityViewIsModal
        {...props}
      >
        <BottomSheetView
          accessibilityLabel={accessibilityLabel}
          accessibilityViewIsModal
          style={[styles.content, { padding: spacing[4] }]}
        >
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

BottomSheet.displayName = "BottomSheet";

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
