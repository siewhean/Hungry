// Render harness: mounts a screen or component with react-native-web inside jsdom, wrapped in the
// app theme and a fake navigation, and gives small helpers to read and press what is on screen.
// Used by `*.render.test.tsx` files; run with `npm run test:render`.

import {
  NavigationContext,
  NavigationRouteContext,
  PreventRemoveContext,
} from "@react-navigation/native";
import { act, createElement, type ComponentType, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { HungryThemeProvider } from "@/theme";

const { window } = globalThis as unknown as { window: Window & typeof globalThis };

export type FakeNavigation = ReturnType<typeof createFakeNavigation>;

export function createFakeNavigation() {
  const calls: { method: string; args: unknown[] }[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };
  const navigation = {
    calls,
    navigate: record("navigate"),
    push: record("push"),
    replace: record("replace"),
    goBack: record("goBack"),
    popToTop: record("popToTop"),
    popTo: record("popTo"),
    reset: record("reset"),
    setParams: record("setParams"),
    setOptions: record("setOptions"),
    dispatch: record("dispatch"),
    canGoBack: () => true,
    isFocused: () => true,
    getParent: () => undefined,
    getState: () => ({
      index: 0,
      routes: [],
      key: "test",
      routeNames: [],
      type: "stack",
      stale: false,
    }),
    addListener: () => () => undefined,
    removeListener: () => undefined,
    getId: () => undefined,
    /** usePreventRemove state by hook id; native-stack blocks the iOS swipe from this. */
    preventRemove: new Map<string, boolean>(),
    /** True while any usePreventRemove on the screen is on (native-stack's preventNativeDismiss). */
    isRemovePrevented: () => [...navigation.preventRemove.values()].some(Boolean),
  };
  return navigation;
}

export interface RenderResult {
  container: HTMLElement;
  navigation: FakeNavigation;
  text(): string;
  html(): string;
  /** First element whose own text is `text` (exact), or null. */
  findByText(text: string | RegExp): HTMLElement | null;
  findByLabel(label: string | RegExp): HTMLElement | null;
  findByTestId(id: string): HTMLElement | null;
  press(target: HTMLElement | null): Promise<void>;
  type(target: HTMLElement | null, value: string): Promise<void>;
  /** Lets pending promises and effects settle (store loads, mock service calls). */
  settle(): Promise<void>;
  rerender(element: ReactElement): Promise<void>;
  unmount(): Promise<void>;
}

function matches(value: string | null | undefined, expected: string | RegExp) {
  if (value == null) return false;
  return typeof expected === "string" ? value.trim() === expected : expected.test(value);
}

function ownText(element: Element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent ?? "")
    .join("");
}

function nearestPressable(element: HTMLElement): HTMLElement {
  let node: HTMLElement | null = element;
  while (node) {
    const role = node.getAttribute("role");
    if (
      role === "button" ||
      role === "link" ||
      node.getAttribute("tabindex") === "0" ||
      node.tagName === "BUTTON"
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return element;
}

const mounted = new Set<() => Promise<void>>();

/** Unmounts everything a test rendered; call from `afterEach`. */
export async function cleanup() {
  for (const unmount of [...mounted]) await unmount();
}

export async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  }
}

export async function render(
  element: ReactElement,
  options: {
    route?: { name?: string; params?: Record<string, unknown> };
    navigation?: FakeNavigation;
  } = {},
): Promise<RenderResult> {
  const navigation = options.navigation ?? createFakeNavigation();
  const route = {
    key: "test-route",
    name: options.route?.name ?? "Test",
    params: options.route?.params,
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  const preventRemove = navigation.preventRemove ?? new Map<string, boolean>();
  const preventRemoveContext = {
    preventedRoutes: {},
    setPreventRemove: (id: string, _routeKey: string, value: boolean) => {
      preventRemove.set(id, value);
    },
    notifyPreventRemove: () => undefined,
  };
  const wrap = (child: ReactElement) =>
    createElement(
      HungryThemeProvider,
      null,
      createElement(
        NavigationContext.Provider,
        { value: navigation as never },
        createElement(
          PreventRemoveContext.Provider,
          { value: preventRemoveContext },
          createElement(NavigationRouteContext.Provider, { value: route as never }, child),
        ),
      ),
    );

  await act(async () => {
    root.render(wrap(element));
  });
  await settle();

  // Modals render in a portal under <body>, outside `container`, so lookups search the whole page.
  async function unmount() {
    mounted.delete(unmount);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
  mounted.add(unmount);

  const find = (predicate: (el: HTMLElement) => boolean) =>
    (Array.from(document.body.querySelectorAll("*")) as HTMLElement[]).find(predicate) ?? null;

  return {
    container,
    navigation,
    text: () => document.body.textContent ?? "",
    html: () => document.body.innerHTML,
    findByText: (text) => find((el) => matches(ownText(el), text)),
    findByLabel: (label) => find((el) => matches(el.getAttribute("aria-label"), label)),
    findByTestId: (id) => find((el) => el.getAttribute("data-testid") === id),
    async press(target) {
      assertFound(target);
      const pressable = nearestPressable(target);
      await act(async () => {
        pressable.dispatchEvent(
          new window.MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      });
      await settle();
    },
    async type(target, value) {
      assertFound(target);
      const input = target as HTMLInputElement;
      const proto =
        input.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(input, value);
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
      await settle();
    },
    settle,
    async rerender(next) {
      await act(async () => {
        root.render(wrap(next));
      });
      await settle();
    },
    unmount,
  };
}

/** Mounts a navigator screen the way the stack would: with `navigation` and `route` props. */
export async function renderScreen<P extends object = object>(
  Component: ComponentType<never>,
  options: { name?: string; params?: P; navigation?: FakeNavigation } = {},
): Promise<RenderResult> {
  const navigation = options.navigation ?? createFakeNavigation();
  const route = {
    key: "test-route",
    name: options.name ?? Component.displayName ?? Component.name,
    params: options.params,
  };
  return render(
    createElement(Component as ComponentType<Record<string, unknown>>, { navigation, route }),
    {
      navigation,
      route: route as { name?: string; params?: Record<string, unknown> },
    },
  );
}

function assertFound(target: HTMLElement | null): asserts target is HTMLElement {
  if (!target) throw new Error("The element to interact with was not found on screen.");
}
