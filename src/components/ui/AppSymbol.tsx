import { Platform } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import {
  Check,
  MapPin,
  MessageSquareHeart,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react-native";

type SFSymbolName = Extract<SymbolViewProps["name"], string>;

/**
 * Every icon is named by what it means. iOS draws the SF Symbol; Android and web draw the lucide
 * icon of the same meaning, so all three platforms keep one icon language and nothing falls
 * back to an emoji. Add a row here when a screen needs a new symbol.
 */
const APP_SYMBOLS = {
  rankedByPeople: { ios: "star.bubble.fill", lucide: MessageSquareHeart },
  nearYou: { ios: "mappin.and.ellipse", lucide: MapPin },
  yourTaste: { ios: "slider.horizontal.3", lucide: SlidersHorizontal },
  selected: { ios: "checkmark", lucide: Check },
} as const satisfies Record<string, { ios: SFSymbolName; lucide: LucideIcon }>;

export type AppSymbolName = keyof typeof APP_SYMBOLS;

type SymbolWeight = "regular" | "medium" | "semibold" | "bold";
const LUCIDE_STROKE: Record<SymbolWeight, number> = {
  regular: 1.75,
  medium: 2,
  semibold: 2.25,
  bold: 2.5,
};

interface AppSymbolProps {
  name: AppSymbolName;
  color: string;
  size?: number;
  /** Matches the weight of the text beside it. */
  weight?: SymbolWeight;
}

/**
 * A decorative symbol: the control or text beside it carries the meaning, so screen readers
 * skip it. Hierarchical rendering on iOS, tinted with `color`.
 */
export function AppSymbol({ name, color, size = 22, weight = "semibold" }: AppSymbolProps) {
  const symbol = APP_SYMBOLS[name];
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={symbol.ios}
        type="hierarchical"
        weight={weight}
        tintColor={color}
        size={size}
        resizeMode="scaleAspectFit"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ height: size, width: size }}
      />
    );
  }
  const Icon = symbol.lucide;
  return <Icon color={color} size={size} strokeWidth={LUCIDE_STROKE[weight]} />;
}
