import type { NavigationProp } from "@react-navigation/native";

type AnyParamList = Record<string, object | undefined>;

export function getRootNavigation(navigation: NavigationProp<AnyParamList>) {
  let current: NavigationProp<AnyParamList> | undefined = navigation;

  while (current?.getParent?.()) {
    current = current.getParent() as NavigationProp<AnyParamList>;
  }

  return current ?? navigation;
}
