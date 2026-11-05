import { forwardRef } from "react";
import { Platform, ScrollView as NativeScrollView, type ScrollViewProps } from "react-native";
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";

const BaseScrollView = (
  Platform.OS === "web" ? NativeScrollView : GestureScrollView
) as typeof NativeScrollView;

// React Native's ScrollView keeps taps for itself while it is still sliding (see
// patches/react-native+0.86.3.patch, which adds this prop). On a row of cards that meant the first
// tap only stopped the slide. This lets the tap reach the card under the finger as well.
const TAPS_WHILE_SCROLLING = Platform.OS === "web" ? {} : { allowTapsWhileScrolling: true };

/**
 * The sideways scroller for Home's rows and chips. On a phone it is gesture-handler's
 * ScrollView, so each row is scrolled by its own finger: two fingers can swipe two rows (or a row
 * and the chips) at the same time, which React Native's own responder system does not allow.
 * A card or chip can be tapped while the row is still sliding. On the web it is the plain
 * ScrollView.
 */
export const RailScrollView = forwardRef<NativeScrollView, ScrollViewProps>(
  function RailScrollView(props, ref) {
    return <BaseScrollView ref={ref} {...TAPS_WHILE_SCROLLING} {...props} />;
  },
);
