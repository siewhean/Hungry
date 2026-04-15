import { useCallback, useEffect, useMemo, useRef } from "react";
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";

import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { QuickReviewSheet } from "./QuickReviewSheet";

export function QuickReviewModal() {
  const { palette, spacing } = useHungryTheme();
  const payload = useUIStore((state) => state.quickReview);
  const hideQuickReview = useUIStore((state) => state.hideQuickReview);
  const showReviewSuccess = useUIStore((state) => state.showReviewSuccess);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["70%"], []);

  useEffect(() => {
    if (payload) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [payload]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
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
      backgroundStyle={{ backgroundColor: palette.surface }}
      handleIndicatorStyle={{ backgroundColor: palette.border }}
    >
      <BottomSheetView style={{ padding: spacing[5] }}>
        <QuickReviewSheet
          venueName={payload.venueName}
          dishName={payload.dishName}
          onSuccess={(data) => {
            hideQuickReview();
            showReviewSuccess({
              venueName: payload.venueName,
              dishName: payload.dishName ?? "Dish",
              rating: data.rating,
              pointsEarned: 10 + data.tagCount * 2,
              xpEarned: 10 + data.tagCount * 2,
              tagCount: data.tagCount,
            });
          }}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
