/** The slice of a navigation object the wheel screens need to leave the whole WheelStack. */
interface WheelStackNavigation {
  getParent():
    | { canGoBack(): boolean; goBack(): void; navigate(name: "MainTabs"): void }
    | undefined;
  popToTop(): void;
}

/**
 * Leaves the WheelStack (back to wherever the wheel was opened from). Wheel screens
 * replace each other, so `popToTop` alone lands on a lobby with no wheel behind it.
 * WheelStack clears the party when it unmounts.
 */
export function leaveWheelStack(navigation: WheelStackNavigation): void {
  const root = navigation.getParent();
  if (!root) {
    navigation.popToTop();
    return;
  }
  if (root.canGoBack()) root.goBack();
  else root.navigate("MainTabs");
}
