import { SymbolView, type SFSymbol } from "expo-symbols";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react-native";
import { Platform, View } from "react-native";

export type AppSymbolProps = {
  /** The SF Symbol shown on iOS. */
  name: SFSymbol;
  /** The Lucide icon shown on Android and web, so every icon keeps one weight and size scale. */
  fallback: ComponentType<LucideProps>;
  size?: number;
  color: string;
  /** Fills the Lucide fallback; SF Symbols are filled by picking the `.fill` name. */
  filled?: boolean;
  /** Set for an icon that carries meaning on its own; a decorative icon is hidden from VoiceOver. */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * One icon for the whole app: a real SF Symbol on iOS and the matching Lucide icon elsewhere.
 * Use it instead of text glyphs (★ ▲ ▼ → ✓), which take the text colour, scale like a font and are
 * read out as "black star".
 */
export function AppSymbol({
  name,
  fallback: Fallback,
  size = 16,
  color,
  filled = false,
  accessibilityLabel,
  testID,
}: AppSymbolProps) {
  const labelled = Boolean(accessibilityLabel);

  return (
    <View
      testID={testID}
      accessible={labelled}
      accessibilityRole={labelled ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!labelled}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {Platform.OS === "ios" ? (
        <SymbolView
          name={name}
          size={size}
          tintColor={color}
          resizeMode="scaleAspectFit"
          style={{ width: size, height: size }}
        />
      ) : (
        <Fallback size={size} color={color} fill={filled ? color : "none"} />
      )}
    </View>
  );
}
