import React from "react";
import { View, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { BadgeCheck } from "lucide-react-native";
import { useHungryTheme } from "@/theme";
import type { VerificationStatus } from "@/types/domain";

export interface VerifiedBadgeProps {
  status: VerificationStatus;
  size?: "sm" | "md" | "lg";
  onPress?: () => void;
}

const SIZE_MAP = {
  sm: 14,
  md: 18,
  lg: 24,
};

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ status, size = "md", onPress }) => {
  const { palette } = useHungryTheme();

  if (status !== "verified") {
    return null;
  }

  const iconSize = SIZE_MAP[size];

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Alert.alert("Verified by Hungry", "This business has been verified by the Hungry platform.");
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.container}
    >
      <BadgeCheck size={iconSize} color={palette.orange} fill={palette.surface} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
});
