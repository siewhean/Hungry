import { useContext } from "react";
import { NavigationContext } from "@react-navigation/native";

import { isInsideMainTabs, type NavLike } from "@/features/navigation/insideMainTabs";

/**
 * Screens under the tab bar already clear the home indicator (the bar pads for it), so their
 * scroll content needs only a small gap at the end; pushed screens need the inset as well.
 */
export function useIsInsideMainTabs(): boolean {
  const navigation = useContext(NavigationContext) as NavLike | undefined;
  return isInsideMainTabs(navigation);
}
