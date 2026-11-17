import { useCallback, useEffect, useMemo, useRef, type ComponentProps } from "react";
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";

import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { QuickReviewSheet } from "./QuickReviewSheet";

export function QuickReviewModal() {
  const { palette, spacing } = useHungryTheme();
  const payload = useUIStore((state) => state.quickReview);
  const hideQuickReview = useUIStore((state) => state.hideQuickReview);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["80%"], []); // Increased to 80% to give the wizard more room

  useEffect(() => {
    if (payload) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [payload]);

  const renderBackdrop = useCallback(
    (props: ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        accessibilityRole="button"
        accessibilityLabel="Close quick review"
        accessibilityHint="Dismisses the quick review sheet"
      />
    ),
    [],
  );

  if (!payload) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      onDismiss={hideQuickReview}
      accessibilityLabel="Quick review"
      accessibilityViewIsModal
      backgroundStyle={{ backgroundColor: palette.surface }}
      handleIndicatorStyle={{ backgroundColor: palette.border }}
    >
      <BottomSheetView style={{ flex: 1, padding: spacing[5] }}>
        <QuickReviewSheet
          venueId={payload.venueId}
          venueName={payload.venueName}
          dishId={payload.dishId}
          dishName={payload.dishName}
          onSuccess={() => {
            hideQuickReview();
          }}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
