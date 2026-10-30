import { Platform } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import {
  BarChart3,
  Bell,
  BellOff,
  BellRing,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Hand,
  History,
  Info,
  KeyRound,
  LocateFixed,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquareHeart,
  RefreshCw,
  RotateCcw,
  Salad,
  Scale,
  Settings2,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  UserPlus,
  UserX,
  Utensils,
  Vibrate,
  Wallet,
  WandSparkles,
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
  // Settings
  menuChanges: { ios: "bell.badge", lucide: BellRing },
  notificationsOff: { ios: "bell.slash", lucide: BellOff },
  notifications: { ios: "bell", lucide: Bell },
  weeklyPicks: { ios: "sparkles", lucide: Sparkles },
  mealIdeas: { ios: "fork.knife", lucide: Utensils },
  followRequests: { ios: "person.badge.plus", lucide: UserPlus },
  followedStalls: { ios: "storefront", lucide: Store },
  retry: { ios: "arrow.clockwise", lucide: RefreshCw },
  dietary: { ios: "leaf", lucide: Salad },
  flavourProfile: { ios: "safari", lucide: Compass },
  mealBudget: { ios: "wallet.pass", lucide: Wallet },
  tryingNewFood: { ios: "sparkles", lucide: Sparkles },
  foodHistory: { ios: "clock.arrow.circlepath", lucide: History },
  profilePublic: { ios: "eye", lucide: Eye },
  profilePrivate: { ios: "lock", lucide: Lock },
  blocked: { ios: "person.fill.xmark", lucide: UserX },
  analytics: { ios: "chart.bar", lucide: BarChart3 },
  aiSearch: { ios: "sparkle.magnifyingglass", lucide: WandSparkles },
  location: { ios: "location", lucide: LocateFixed },
  resetLocation: { ios: "arrow.counterclockwise", lucide: RotateCcw },
  phonePermissions: { ios: "gearshape", lucide: Settings2 },
  downloadData: { ios: "square.and.arrow.down", lucide: Download },
  clearCache: { ios: "trash", lucide: Trash2 },
  accountDeletionInfo: { ios: "lock.shield", lucide: Shield },
  changePassword: { ios: "key", lucide: KeyRound },
  signOutEverywhere: { ios: "iphone.and.arrow.forward", lucide: Smartphone },
  haptics: { ios: "iphone.radiowaves.left.and.right", lucide: Vibrate },
  leftHanded: { ios: "hand.point.left", lucide: Hand },
  contact: { ios: "envelope", lucide: Mail },
  privacyPolicy: { ios: "hand.raised", lucide: Hand },
  terms: { ios: "doc.text", lucide: FileText },
  legal: { ios: "scalemass", lucide: Scale },
  openData: { ios: "server.rack", lucide: Database },
  version: { ios: "info.circle", lucide: Info },
  signOut: { ios: "rectangle.portrait.and.arrow.right", lucide: LogOut },
  deleteAccount: { ios: "trash", lucide: Trash2 },
  chevronRight: { ios: "chevron.right", lucide: ChevronRight },
  chevronDown: { ios: "chevron.down", lucide: ChevronDown },
  external: { ios: "arrow.up.right.square", lucide: ExternalLink },
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
