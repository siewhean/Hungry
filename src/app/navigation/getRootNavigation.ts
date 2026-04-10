import type { NavigationProp, ParamListBase } from "@react-navigation/native";

export function getRootNavigation(navigation: NavigationProp<ParamListBase>) {
  let current: NavigationProp<ParamListBase> | undefined = navigation;

  while (current?.getParent?.()) {
    current = current.getParent() as NavigationProp<ParamListBase>;
  }

  return current ?? navigation;
}
