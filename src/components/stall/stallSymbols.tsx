import {
  BellPlus,
  BellRing,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock3,
  Globe,
  ListPlus,
  Mail,
  MapPin,
  MessageCircle,
  PenLine,
  Phone,
  SlidersHorizontal,
} from "lucide-react-native";

import { AppSymbol } from "@/components/ui/AppSymbol";

/**
 * The stall page's icons: a system SF Symbol on iOS, the matching Lucide icon elsewhere. Each
 * takes the `{ size, color, fill }` props the detail bar and header pass, so one slots in where
 * a Lucide icon went. Back, Share, Save, Visited, the star and the checkmark are in
 * `@/components/dish/dishSymbols` and shared with the dish page.
 */
export type StallSymbolProps = { size?: number; color?: string; fill?: string };

export function PhoneSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="phone.fill" fallback={Phone} size={size} color={color} />;
}

export function EmailSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="envelope" fallback={Mail} size={size} color={color} />;
}

export function WebsiteSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="globe" fallback={Globe} size={size} color={color} />;
}

export function HoursSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="clock" fallback={Clock3} size={size} color={color} />;
}

export function ChevronDownSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="chevron.down" fallback={ChevronDown} size={size} color={color} />;
}

export function ChevronUpSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="chevron.up" fallback={ChevronUp} size={size} color={color} />;
}

export function ChevronRightSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="chevron.right" fallback={ChevronRight} size={size} color={color} />;
}

export function MenuFilterSymbol({ size = 16, color = "#000" }: StallSymbolProps) {
  return (
    <AppSymbol
      name="line.3.horizontal.decrease.circle"
      fallback={SlidersHorizontal}
      size={size}
      color={color}
    />
  );
}

export function SelectedSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="checkmark" fallback={Check} size={size} color={color} />;
}

export function HelpSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="questionmark.circle" fallback={CircleHelp} size={size} color={color} />;
}

export function WriteReviewSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="square.and.pencil" fallback={PenLine} size={size} color={color} />;
}

export function DirectionsSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return (
    <AppSymbol
      name="arrow.triangle.turn.up.right.diamond.fill"
      fallback={MapPin}
      size={size}
      color={color}
    />
  );
}

export function AddToListSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="text.badge.plus" fallback={ListPlus} size={size} color={color} />;
}

export function NoReviewsSymbol({ size = 36, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="bubble.left" fallback={MessageCircle} size={size} color={color} />;
}

export function FollowSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="bell.badge" fallback={BellPlus} size={size} color={color} />;
}

export function FollowingSymbol({ size = 18, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="bell.fill" fallback={BellRing} size={size} color={color} />;
}

/** The saved-count pill's bookmark. */
export function SavedCountSymbol({ size = 14, color = "#000" }: StallSymbolProps) {
  return <AppSymbol name="bookmark.fill" fallback={Bookmark} filled size={size} color={color} />;
}
