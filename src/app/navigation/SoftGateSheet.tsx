import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { AppText, Button } from "@/components/ui";

interface SoftGateSheetProps {
  onLogin: () => void;
}

export function SoftGateSheet({ onLogin }: SoftGateSheetProps) {
  const { palette, spacing } = useHungryTheme();
  const visible = useUIStore((state) => state.softGateVisible);
  const hideSoftGate = useUIStore((state) => state.hideSoftGate);
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["34%"], []);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <BottomSheetModal
      enablePanDownToClose
      index={0}
      onDismiss={hideSoftGate}
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: palette.surface }}
      handleIndicatorStyle={{ backgroundColor: palette.border }}
    >
      <BottomSheetView style={{ flex: 1, gap: spacing[4], padding: spacing[5] }}>
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h2">Keep browsing as a guest or sign in to contribute</AppText>
          <AppText tone="secondary">
            Hungry leaves discovery open, but posting, saving, and reviews work best once your profile is active.
          </AppText>
        </View>
        <Button
          label="Continue with email"
          onPress={() => {
            hideSoftGate();
            onLogin();
          }}
        />
        <Button label="Keep exploring as guest" onPress={hideSoftGate} variant="ghost" />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
