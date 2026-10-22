// Node test runtime stub for `react-native`.
// Our unit tests target business logic, not native rendering.

export const Platform = {
  OS: "test",
  select: (spec: Record<string, any>) => spec.default,
} as const;

export function useWindowDimensions() {
  return { width: 390, height: 844, scale: 3, fontScale: 1 };
}

export const StyleSheet = {
  create<T extends Record<string, any>>(styles: T): T {
    return styles;
  },
  absoluteFill: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
} as const;

export const View = "View" as any;
export const Text = "Text" as any;
export const ScrollView = "ScrollView" as any;
export const Pressable = "Pressable" as any;

export const Animated = {
  Value: class {
    constructor(_value: any) {}
  },
  timing: () => ({ start: () => {} }),
  parallel: () => ({ start: () => {} }),
  spring: () => ({ start: () => {} }),
  loop: () => ({ start: () => {} }),
  sequence: () => ({ start: () => {} }),
} as any;

export const ActivityIndicator = "ActivityIndicator" as any;

export type StubAlertButton = { text?: string; style?: string; onPress?: () => void };
export type StubAlertCall = { title: string; message?: string; buttons?: StubAlertButton[] };

/** Records every Alert.alert so tests can assert on it and press its buttons. */
export const alertCalls: StubAlertCall[] = [];
export const Alert = {
  alert(title: string, message?: string, buttons?: StubAlertButton[]) {
    alertCalls.push({ title, message, buttons });
  },
} as const;
