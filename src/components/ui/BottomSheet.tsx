import { useCallback, useMemo, forwardRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
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
}

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  ({ children, snapPoints: customSnapPoints, ...props }, ref) => {
    const { palette, spacing, radii } = useHungryTheme();

    const defaultSnapPoints = useMemo(() => ["50%", "90%"], []);
    const snapPoints = customSnapPoints || defaultSnapPoints;

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: palette.surface }}
        handleIndicatorStyle={{ backgroundColor: palette.border }}
        {...props}
      >
        <BottomSheetView style={[styles.content, { padding: spacing[4] }]}>
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
