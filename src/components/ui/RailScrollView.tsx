import { Platform, ScrollView as NativeScrollView } from "react-native";
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";

/**
 * The sideways scroller for Home's rows and chips. On a phone it is gesture-handler's
 * ScrollView, so each row is scrolled by its own finger: two fingers can swipe two rows (or a row
 * and the chips) at the same time, which React Native's own responder system does not allow.
 * On the web it is the plain ScrollView.
 */
export const RailScrollView = (
  Platform.OS === "web" ? NativeScrollView : GestureScrollView
) as typeof NativeScrollView;
