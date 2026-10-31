import { SymbolView, type SFSymbol, type SymbolViewProps } from "expo-symbols";
import type { ComponentType } from "react";
import {
  Check,
  MapPin,
  MessageSquareHeart,
  SlidersHorizontal,
  Utensils,
  type LucideIcon,
  type LucideProps,
} from "lucide-react-native";
import { Platform, View } from "react-native";

type SFSymbolName = Extract<SymbolViewProps["name"], string>;

/**
 * Every icon is named by what it means. iOS draws the SF Symbol; Android and web draw the lucide
 * icon of the same meaning, so all three platforms keep one icon language and nothing falls
 * back to an emoji. Add a row here when a screen needs a new symbol, or pass an SF Symbol name
 * with a `fallback` icon for a one-off.
 */
const APP_SYMBOLS = {
  rankedByPeople: { ios: "star.bubble.fill", lucide: MessageSquareHeart },
  nearYou: { ios: "mappin.and.ellipse", lucide: MapPin },
  yourTaste: { ios: "slider.horizontal.3", lucide: SlidersHorizontal },
  selected: { ios: "checkmark", lucide: Check },
  noPhoto: { ios: "fork.knife", lucide: Utensils },
} as const satisfies Record<string, { ios: SFSymbolName; lucide: LucideIcon }>;

export type AppSymbolName = keyof typeof APP_SYMBOLS;

type SymbolWeight = "regular" | "medium" | "semibold" | "bold";
const LUCIDE_STROKE: Record<SymbolWeight, number> = {
  regular: 1.75,
  medium: 2,
  semibold: 2.25,
  bold: 2.5,
};

type AppSymbolBaseProps = {
  size?: number;
  color: string;
  /** Matches the weight of the text beside it. */
  weight?: SymbolWeight;
  /** Set for an icon that carries meaning on its own; a decorative icon is hidden from VoiceOver. */
  accessibilityLabel?: string;
  testID?: string;
};

type RegistrySymbolProps = AppSymbolBaseProps & {
  /** A named row of the registry above. */
  name: AppSymbolName;
  fallback?: never;
  filled?: never;
};

type RawSymbolProps = AppSymbolBaseProps & {
  /** The SF Symbol shown on iOS. */
  name: SFSymbol;
  /** The Lucide icon shown on Android and web, so every icon keeps one weight and size scale. */
  fallback: ComponentType<LucideProps>;
  /** Fills the Lucide fallback; SF Symbols are filled by picking the `.fill` name. */
  filled?: boolean;
};

export type AppSymbolProps = RegistrySymbolProps | RawSymbolProps;

function isRegistryName(name: string): name is AppSymbolName {
  return Object.prototype.hasOwnProperty.call(APP_SYMBOLS, name);
}

/**
 * One icon for the whole app: a real SF Symbol on iOS and the matching Lucide icon elsewhere.
 * Use it instead of text glyphs (★ ▲ ▼ → ✓), which take the text colour, scale like a font and are
 * read out as "black star".
 */
export function AppSymbol(props: AppSymbolProps) {
  const { color, accessibilityLabel, testID } = props;
  const labelled = Boolean(accessibilityLabel);

  if (isRegistryName(props.name)) {
    const symbol = APP_SYMBOLS[props.name];
    const size = props.size ?? 22;
    const weight = props.weight ?? "semibold";
    const Icon = symbol.lucide;
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
            name={symbol.ios}
            type="hierarchical"
            weight={weight}
            tintColor={color}
            size={size}
            resizeMode="scaleAspectFit"
            style={{ height: size, width: size }}
          />
        ) : (
          <Icon color={color} size={size} strokeWidth={LUCIDE_STROKE[weight]} />
        )}
      </View>
    );
  }

  const { name, fallback: Fallback, filled = false, weight } = props as RawSymbolProps;
  const size = props.size ?? 16;
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
          weight={weight}
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
