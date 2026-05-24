import React, { useRef, useCallback } from "react";
import { View, TouchableOpacity, Pressable } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ChevronDown, Store, CheckCircle2 } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText, BottomSheet } from "@/components/ui";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { formatBusinessType } from "@/features/merchant/merchantReadiness";

export const OutletSwitcher: React.FC = () => {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const account = useMerchantStore((state) => state.account);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const setActiveOutlet = useMerchantStore((state) => state.setActiveOutlet);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  if (!account || !activeOutlet) return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePresentModalPress}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            gap: spacing[2],
          },
          {
            backgroundColor: palette.surface,
            borderRadius: componentRadii.button,
            borderWidth: 1,
            borderColor: palette.border,
            maxWidth: "100%",
            flexShrink: 1,
          },
        ]}
      >
        <Store size={14} color={palette.orange} />
        <AppText variant="bodySmallBold" numberOfLines={2} style={{ flexShrink: 1 }}>
          {activeOutlet.name}
        </AppText>
        <ChevronDown size={14} color={palette.textMuted} />
      </TouchableOpacity>

      <BottomSheet ref={bottomSheetRef} snapPoints={["40%", "60%"]}>
        <View style={{ gap: spacing[4], paddingBottom: spacing[6] }}>
          <View style={{ marginBottom: spacing[2] }}>
            <AppText variant="h2">Switch Outlet</AppText>
            <AppText tone="secondary">Select a business location to manage</AppText>
          </View>

          <View style={{ gap: spacing[2] }}>
            {account.outlets.map((outlet) => {
              const isActive = outlet.id === activeOutlet.id;
              return (
                <Pressable
                  key={outlet.id}
                  onPress={() => {
                    setActiveOutlet(outlet.id);
                    bottomSheetRef.current?.dismiss();
                  }}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                    {
                      backgroundColor: isActive
                        ? palette.orangeLight
                        : pressed
                          ? palette.bgSoft
                          : palette.surface,
                      borderColor: isActive ? palette.orange : palette.border,
                      borderRadius: componentRadii.card,
                      borderWidth: 1,
                      padding: spacing[4],
                    },
                  ]}
                >
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], flex: 1 }}
                  >
                    <Store size={20} color={isActive ? palette.orange : palette.text} />
                    <View style={{ flex: 1 }}>
                      <AppText
                        style={{
                          fontWeight: "700",
                          color: isActive ? palette.orange : palette.text,
                        }}
                      >
                        {outlet.name}
                      </AppText>
                      <AppText variant="micro" tone={isActive ? "accent" : "secondary"}>
                        {formatBusinessType(outlet.businessType)}
                        {outlet.unitNumber ? ` · ${outlet.unitNumber}` : ""}
                      </AppText>
                    </View>
                  </View>
                  {isActive && <CheckCircle2 size={20} color={palette.orange} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheet>
    </>
  );
};
