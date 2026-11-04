import * as React from "react";
import {
  Animated,
  Keyboard,
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  createNavigatorFactory,
  TabRouter,
  useNavigationBuilder,
  type DefaultNavigatorOptions,
  type NavigatorTypeBagBase,
  type ParamListBase,
  type StaticConfig,
  type TabActionHelpers,
  type TabNavigationState,
  type TabRouterOptions,
  type TypedNavigator,
} from "@react-navigation/native";
import type {
  MaterialTopTabBarProps,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
  MaterialTopTabNavigationProp,
} from "@react-navigation/material-top-tabs";

import {
  clampEdgeDrag,
  edgeDragDirection,
  edgeSettleIndex,
  shouldMountPage,
  type PagerDirection,
} from "@/features/navigation/edgePager";
import { selectHaptic } from "@/lib/haptics";

const SETTLE_SPRING = { stiffness: 900, damping: 90, mass: 3, overshootClamping: true } as const;

type EdgeSwipeTabsConfig = {
  /** Draws the bar under the pages. */
  tabBar: (props: MaterialTopTabBarProps) => React.ReactNode;
  /** How many routes, counted from the first, are pages in the swipe order; the rest only redirect. */
  pageCount: number;
  /** Every page stays mounted (so a drag can show its neighbour) once warm-up has finished. */
  mountAllPages: boolean;
  /** Reduce Motion: the pages settle without the spring. */
  reduceMotion: boolean;
};

/** The parts of the navigation helpers and descriptors the pages use. */
type PagesNavigation = { jumpTo: (name: string) => void };
type PagesDescriptors = Record<string, { render: () => React.ReactNode }>;

type ViewProps = EdgeSwipeTabsConfig & {
  state: TabNavigationState<ParamListBase>;
  navigation: PagesNavigation;
  descriptors: PagesDescriptors;
};

/**
 * The main pages side by side. A drag that starts at a screen edge slides the whole row with the
 * finger, so the page you leave and the page you reach show together, and it settles on the
 * nearer one when the finger lifts. A change from anywhere else (the tab bar) shows at once.
 */
export function EdgeSwipePages({
  state,
  navigation,
  descriptors,
  tabBar,
  pageCount,
  mountAllPages,
  reduceMotion,
}: ViewProps) {
  const [width, setWidth] = React.useState(0);
  const panX = React.useRef(new Animated.Value(0)).current;
  const [visited, setVisited] = React.useState<ReadonlySet<string>>(
    () => new Set([state.routes[state.index].key]),
  );
  const latest = React.useRef({ state, navigation, width, pageCount, reduceMotion });
  latest.current = { state, navigation, width, pageCount, reduceMotion };
  const drag = React.useRef<{ direction: PagerDirection; startOffset: number } | null>(null);

  const focusedKey = state.routes[state.index].key;
  React.useEffect(() => {
    setVisited((previous) =>
      previous.has(focusedKey) ? previous : new Set(previous).add(focusedKey),
    );
  }, [focusedKey]);

  // A change that did not come from a drag (the tab bar, a redirect) shows at once.
  React.useLayoutEffect(() => {
    if (drag.current) return;
    panX.stopAnimation();
    panX.setValue(-state.index * width);
  }, [panX, state.index, width]);

  const responder = React.useMemo(() => {
    const settle = (event: { dx: number; vx: number }) => {
      const current = drag.current;
      drag.current = null;
      if (!current) return;
      const { state: s, navigation: nav, width: w, reduceMotion: reduced } = latest.current;
      const target = edgeSettleIndex({
        index: s.index,
        direction: current.direction,
        dx: event.dx,
        vx: event.vx,
        width: w,
      });
      const toValue = -target * w;
      const finish = () => {
        if (target !== s.index) {
          selectHaptic();
          nav.jumpTo(s.routes[target].name);
        }
      };
      if (reduced) {
        panX.setValue(toValue);
        finish();
        return;
      }
      Animated.spring(panX, { ...SETTLE_SPRING, toValue, useNativeDriver: false }).start(
        ({ finished }) => {
          if (finished) finish();
        },
      );
    };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (event, gesture) => {
        const { state: s, width: w, pageCount: count } = latest.current;
        return (
          edgeDragDirection({
            startX: gesture.x0,
            dx: gesture.dx,
            dy: gesture.dy,
            width: w,
            index: s.index,
            pageCount: count,
          }) !== null
        );
      },
      onPanResponderGrant: (event, gesture) => {
        const { state: s, width: w, pageCount: count } = latest.current;
        const direction = edgeDragDirection({
          startX: gesture.x0,
          dx: gesture.dx,
          dy: gesture.dy,
          width: w,
          index: s.index,
          pageCount: count,
        });
        if (!direction) return;
        Keyboard.dismiss();
        panX.stopAnimation();
        drag.current = { direction, startOffset: -s.index * w };
      },
      onPanResponderMove: (event, gesture) => {
        const current = drag.current;
        if (!current) return;
        const moved = clampEdgeDrag(gesture.dx, current.direction, latest.current.width);
        panX.setValue(current.startOffset + moved);
      },
      onPanResponderRelease: (event, gesture) => settle(gesture),
      onPanResponderTerminate: (event, gesture) => settle(gesture),
      onPanResponderTerminationRequest: () => false,
    });
  }, [panX]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const laidOut = width > 0;

  const bar = tabBar({
    state,
    navigation,
    descriptors,
  } as unknown as MaterialTopTabBarProps);

  return (
    <View style={styles.root}>
      <View style={styles.pages} onLayout={onLayout} {...responder.panHandlers}>
        <Animated.View
          style={[
            styles.row,
            laidOut
              ? { width: state.routes.length * width, transform: [{ translateX: panX }] }
              : null,
          ]}
        >
          {state.routes.map((route, index) => {
            const focused = index === state.index;
            const mounted = shouldMountPage({
              pageIndex: index,
              focusedIndex: state.index,
              visited: visited.has(route.key),
              warm: mountAllPages && index < pageCount,
            });
            return (
              <View
                key={route.key}
                accessibilityElementsHidden={!focused}
                importantForAccessibility={focused ? "auto" : "no-hide-descendants"}
                style={laidOut ? { width } : focused ? StyleSheet.absoluteFill : styles.hidden}
              >
                {mounted ? descriptors[route.key].render() : null}
              </View>
            );
          })}
        </Animated.View>
      </View>
      {bar}
    </View>
  );
}

type NavigatorProps = DefaultNavigatorOptions<
  ParamListBase,
  string | undefined,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationOptions,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationProp<ParamListBase>
> &
  TabRouterOptions &
  EdgeSwipeTabsConfig;

function EdgeSwipeTabNavigator({
  id,
  initialRouteName,
  backBehavior,
  UNSTABLE_routeNamesChangeBehavior,
  children,
  layout,
  screenListeners,
  screenOptions,
  screenLayout,
  UNSTABLE_router,
  ...rest
}: NavigatorProps) {
  const { state, descriptors, navigation, NavigationContent } = useNavigationBuilder<
    TabNavigationState<ParamListBase>,
    TabRouterOptions,
    TabActionHelpers<ParamListBase>,
    MaterialTopTabNavigationOptions,
    MaterialTopTabNavigationEventMap
  >(TabRouter, {
    id,
    initialRouteName,
    backBehavior,
    UNSTABLE_routeNamesChangeBehavior,
    children,
    layout,
    screenListeners,
    screenOptions,
    screenLayout,
    UNSTABLE_router,
  });

  return (
    <NavigationContent>
      <EdgeSwipePages
        {...rest}
        state={state}
        navigation={navigation as unknown as PagesNavigation}
        descriptors={descriptors as unknown as PagesDescriptors}
      />
    </NavigationContent>
  );
}

export function createEdgeSwipeTabNavigator<
  const ParamList extends ParamListBase,
  const NavigatorID extends string | undefined = string | undefined,
  const TypeBag extends NavigatorTypeBagBase = {
    ParamList: ParamList;
    NavigatorID: NavigatorID;
    State: TabNavigationState<ParamList>;
    ScreenOptions: MaterialTopTabNavigationOptions;
    EventMap: MaterialTopTabNavigationEventMap;
    NavigationList: {
      [RouteName in keyof ParamList]: MaterialTopTabNavigationProp<
        ParamList,
        RouteName,
        NavigatorID
      >;
    };
    Navigator: typeof EdgeSwipeTabNavigator;
  },
  const Config extends StaticConfig<TypeBag> = StaticConfig<TypeBag>,
>(config?: Config): TypedNavigator<TypeBag, Config> {
  return createNavigatorFactory(EdgeSwipeTabNavigator)(config);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pages: { flex: 1, overflow: "hidden" },
  row: { flex: 1, flexDirection: "row", alignItems: "stretch" },
  hidden: { width: 0, overflow: "hidden" },
});
