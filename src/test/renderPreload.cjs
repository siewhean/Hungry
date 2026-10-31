// Preload for component render tests (`npm run test:render`).
//
//  - every `react-native` import, including the ones inside node_modules, resolves to
//    react-native-web, so components render to HTML under Node;
//  - native-only packages (expo modules, reanimated, svg, icons...) resolve to light stubs that
//    render a plain element or return a safe value, so a component's own logic is what runs.
const Module = require("node:module");
const React = require("react");

globalThis.__DEV__ = false;

const hostStub = (name) => {
  const Stub = (props = {}) =>
    React.createElement(
      "span",
      { "data-stub": name, ...(props.testID ? { "data-testid": props.testID } : {}) },
      props.children,
    );
  Stub.displayName = `Stub(${name})`;
  return Stub;
};

// Properties React looks at on a component type; they must read as absent, not as stubs.
const REACT_INSPECTED = new Set([
  "then",
  "childContextTypes",
  "contextTypes",
  "getDerivedStateFromProps",
  "defaultProps",
  "propTypes",
  "displayName",
  "$$typeof",
  "prototype",
  "render",
]);

// A value that can be called, awaited and chained without ever throwing.
const universal = () =>
  new Proxy(function universalStub() {}, {
    get: (_, key) =>
      typeof key === "symbol" || REACT_INSPECTED.has(key)
        ? undefined
        : key === "remove"
          ? () => undefined
          : universal(),
    apply: () => universal(),
  });

function createStub(moduleName, overrides = {}) {
  const cache = new Map();
  const target = () => undefined;
  const proxy = new Proxy(target, {
    // `import * as X` copies own keys, so the keys listed in `overrides` must be visible.
    ownKeys: () => [
      ...new Set([
        ...Reflect.ownKeys(overrides).filter((key) => typeof key === "string"),
        "default",
      ]),
    ],
    getOwnPropertyDescriptor: (_, key) =>
      key === "default" || key in overrides
        ? {
            value: key === "default" ? proxy : overrides[key],
            enumerable: true,
            configurable: true,
            writable: true,
          }
        : undefined,
    has: () => true,
    // Tests replace a stubbed function (e.g. the camera) by assigning to the module.
    set(_, key, value) {
      overrides[key] = value;
      return true;
    },
    get(_, key) {
      if (key in overrides) return overrides[key];
      if (key === "__esModule") return true;
      if (REACT_INSPECTED.has(key)) return undefined;
      if (key === "default") return proxy;
      if (typeof key !== "string") return undefined;
      if (!cache.has(key)) {
        cache.set(
          key,
          /^use[A-Z]/.test(key)
            ? () => ({})
            : /^create[A-Z]/.test(key) && /navigat|tabs/i.test(moduleName)
              ? () => ({
                  Navigator: hostStub("Navigator"),
                  Screen: hostStub("Screen"),
                  Group: hostStub("Group"),
                })
              : /^[a-z]/.test(key)
                ? () => universal()
                : hostStub(`${moduleName}.${key}`),
        );
      }
      return cache.get(key);
    },
    apply: () => undefined,
  });
  return proxy;
}

// The non-modal BottomSheet draws its handle, then its content, in place; the scrollables are
// plain scroll views so a test can scroll and press what is inside them.
function gorhomOverrides() {
  const rn = require("react-native-web");
  const BottomSheet = React.forwardRef(function BottomSheetStub(
    { children, handleComponent: Handle },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({
      snapToIndex: () => undefined,
      snapToPosition: () => undefined,
      expand: () => undefined,
      collapse: () => undefined,
      close: () => undefined,
      forceClose: () => undefined,
    }));
    return React.createElement(
      "div",
      { "data-stub": "@gorhom/bottom-sheet" },
      Handle ? React.createElement(Handle, {}) : null,
      children,
    );
  });
  return { default: BottomSheet, BottomSheetScrollView: rn.ScrollView };
}

function reanimatedOverrides() {
  const rn = require("react-native-web");
  const chain = () =>
    new Proxy(function chained() {}, {
      get: (_, key) => (key === "then" ? undefined : chain()),
      apply: () => chain(),
    });
  const Animated = {
    View: rn.View,
    Text: rn.Text,
    ScrollView: rn.ScrollView,
    Image: rn.Image,
    FlatList: rn.FlatList,
    createAnimatedComponent: (component) => component,
  };
  const known = {
    ...Animated,
    useSharedValue: (value) => ({
      value,
      get() {
        return this.value;
      },
      set(next) {
        this.value = typeof next === "function" ? next(this.value) : next;
      },
    }),
    useAnimatedStyle: () => ({}),
    useAnimatedProps: () => ({}),
    useDerivedValue: (fn) => {
      try {
        return { value: fn() };
      } catch {
        return { value: 0 };
      }
    },
    useAnimatedScrollHandler: () => () => undefined,
    useAnimatedRef: () => ({ current: null }),
    useAnimatedReaction: () => undefined,
    useReducedMotion: () => false,
    useScrollViewOffset: () => ({ value: 0 }),
    useAnimatedKeyboard: () => ({ height: { value: 0 }, state: { value: 0 } }),
    withTiming: (value) => value,
    withSpring: (value) => value,
    withDecay: (value) => value,
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values[values.length - 1],
    withRepeat: (value) => value,
    cancelAnimation: () => undefined,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    interpolate: (_value, _input, output) => output[0],
    interpolateColor: (_value, _input, output) => output[0],
    measure: () => null,
    scrollTo: () => undefined,
    makeMutable: (value) => ({ value }),
    Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
    Easing: chain(),
  };
  // `import { X }` is read from a copy of the module's own keys, so every name must be listed.
  for (const name of [
    "FadeIn",
    "FadeOut",
    "FadeInDown",
    "FadeInUp",
    "FadeInLeft",
    "FadeInRight",
    "FadeOutDown",
    "FadeOutUp",
    "FadeOutLeft",
    "FadeOutRight",
    "SlideInDown",
    "SlideInUp",
    "SlideInLeft",
    "SlideInRight",
    "SlideOutDown",
    "SlideOutUp",
    "SlideOutLeft",
    "SlideOutRight",
    "ZoomIn",
    "ZoomOut",
    "BounceIn",
    "LinearTransition",
    "Layout",
    "ReduceMotion",
    "SharedTransition",
    "Keyframe",
  ]) {
    known[name] = chain();
  }
  known.default = { ...Animated, ...known };
  known.__raw = true;
  known.__esModule = true;
  return new Proxy(known, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "__esModule") return true;
      if (typeof key !== "string") return undefined;
      if (/^use/.test(key)) return () => ({});
      if (/^with/.test(key)) return (value) => value;
      return chain();
    },
  });
}

// FlashList needs native layout to render rows. Under jsdom it renders every row in order, with
// the header, empty and footer components, so list contents can be read in a render test.
function flashListStub() {
  const asElement = (value) =>
    value == null ? null : React.isValidElement(value) ? value : React.createElement(value);
  const FlashList = React.forwardRef(function FlashList(props, ref) {
    React.useImperativeHandle(ref, () => ({
      scrollToOffset() {},
      scrollToIndex() {},
      scrollToEnd() {},
      scrollToTop() {},
    }));
    const data = props.data ?? [];
    const rows = data.map((item, index) =>
      React.createElement(
        React.Fragment,
        { key: props.keyExtractor ? props.keyExtractor(item, index) : String(index) },
        props.renderItem({ item, index, target: "Cell" }),
      ),
    );
    return React.createElement(
      "div",
      { "data-stub": "FlashList" },
      asElement(props.ListHeaderComponent),
      data.length ? rows : asElement(props.ListEmptyComponent),
      asElement(props.ListFooterComponent),
    );
  });
  return FlashList;
}

function permissionResult() {
  return {
    granted: true,
    status: "granted",
    canAskAgain: true,
    expires: "never",
    accessPrivileges: "all",
  };
}

function imagePickerOverrides() {
  const picked = async () => ({ canceled: true, assets: null });
  return {
    requestCameraPermissionsAsync: async () => permissionResult(),
    getCameraPermissionsAsync: async () => permissionResult(),
    requestMediaLibraryPermissionsAsync: async () => permissionResult(),
    getMediaLibraryPermissionsAsync: async () => permissionResult(),
    launchImageLibraryAsync: picked,
    launchCameraAsync: picked,
    MediaTypeOptions: { All: "All", Images: "Images", Videos: "Videos" },
    UIImagePickerPresentationStyle: { AUTOMATIC: "automatic", FULL_SCREEN: "fullScreen" },
    CameraType: { front: "front", back: "back" },
  };
}

function notificationsOverrides() {
  const denied = async () => ({
    granted: false,
    status: "undetermined",
    canAskAgain: true,
    expires: "never",
  });
  return {
    setNotificationHandler: () => undefined,
    getPermissionsAsync: denied,
    requestPermissionsAsync: denied,
    getExpoPushTokenAsync: async () => ({ data: "ExponentPushToken[test]", type: "expo" }),
    getDevicePushTokenAsync: async () => ({ data: "device-token", type: "ios" }),
    addNotificationReceivedListener: () => ({ remove() {} }),
    addNotificationResponseReceivedListener: () => ({ remove() {} }),
    addPushTokenListener: () => ({ remove() {} }),
    getLastNotificationResponseAsync: async () => null,
    getLastNotificationResponse: () => null,
    setBadgeCountAsync: async () => true,
    scheduleNotificationAsync: async () => "notification-id",
    cancelAllScheduledNotificationsAsync: async () => undefined,
    cancelScheduledNotificationAsync: async () => undefined,
    setNotificationChannelAsync: async () => null,
    dismissAllNotificationsAsync: async () => undefined,
    AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5, LOW: 2, MIN: 1, NONE: 0 },
    SchedulableTriggerInputTypes: {
      DAILY: "daily",
      WEEKLY: "weekly",
      TIME_INTERVAL: "timeInterval",
      DATE: "date",
    },
  };
}

const imageStub = (props = {}) =>
  React.createElement("span", {
    "data-stub": "expo-image.Image",
    ...(props.testID ? { "data-testid": props.testID } : {}),
    ref: (el) => {
      if (el)
        el.__triggerError = props.onError ? () => props.onError({ error: "failed" }) : undefined;
    },
  });
imageStub.displayName = "Stub(expo-image.Image)";

const STUBS = [
  [
    /^expo-font$/,
    { useFonts: () => [true, null], loadAsync: async () => {}, isLoaded: () => true },
  ],
  [/^@expo-google-fonts\//, { useFonts: () => [true, null] }],
  [/^react-native-svg$/, {}],
  [/^lucide-react-native$/, {}],
  [/^expo-symbols$/, {}],
  [/^@react-native-menu\/menu$/, {}],
  [/^@expo\/vector-icons/, {}],
  [
    /^expo-image$/,
    {
      // Renders like the other stubs, plus a hook for tests: `el.__triggerError()` runs the
      // image's onError, so a photo that fails to load can be simulated.
      Image: Object.assign(imageStub, {
        prefetch: async () => true,
        clearMemoryCache: async () => true,
        clearDiskCache: async () => true,
      }),
      useImage: () => null,
    },
  ],
  [/^expo-linear-gradient$/, {}],
  [/^expo-blur$/, {}],
  [
    /^expo-haptics$/,
    {
      impactAsync: async () => {},
      notificationAsync: async () => {},
      selectionAsync: async () => {},
      ImpactFeedbackStyle: {},
      NotificationFeedbackType: {},
    },
  ],
  [
    /^react-native-safe-area-context$/,
    {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
      useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
      SafeAreaProvider: ({ children }) => children,
      SafeAreaView: ({ children }) => children,
      SafeAreaInsetsContext: React.createContext({ top: 0, bottom: 0, left: 0, right: 0 }),
      initialWindowMetrics: {
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    },
  ],
  [/^react-native-reanimated$/, reanimatedOverrides()],
  [/^@gorhom\//, gorhomOverrides()],
  [/^@shopify\/react-native-skia$/, {}],
  [/^@shopify\/flash-list$/, { FlashList: flashListStub() }],
  [/^@rnmapbox\/maps$/, {}],
  [/^react-native-pager-view$/, {}],
  [/^react-native-screens/, {}],
  [/^@react-navigation\/(native-stack|bottom-tabs|material-top-tabs)$/, {}],
  [
    /^@sentry\/react-native$/,
    {
      init() {},
      wrap: (c) => c,
      captureException() {},
      captureMessage() {},
      addBreadcrumb() {},
      setUser() {},
      setTag() {},
      setContext() {},
      withScope(fn) {
        fn({ setTag() {}, setContext() {}, setExtra() {}, setLevel() {} });
      },
    },
  ],
  [/^lottie-react-native$/, {}],
  [/^react-native-keyboard-controller$/, {}],
  [/^react-native-view-shot$/, {}],
  [/^@react-native-community\//, {}],
  [/^react-native-gesture-handler$/, { Gesture: universal(), State: {}, Directions: {} }],
  [/^react-native-worklets/, {}],
  [/^expo-constants$/, { expoConfig: { extra: {} }, default: { expoConfig: { extra: {} } } }],
  [
    /^expo-clipboard$/,
    {
      setStringAsync: async () => true,
      getStringAsync: async () => "",
      hasStringAsync: async () => false,
    },
  ],
  [/^expo-image-picker$/, imagePickerOverrides()],
  [/^expo-notifications$/, notificationsOverrides()],
  [
    /^expo-web-browser$/,
    {
      openBrowserAsync: async () => ({ type: "dismiss" }),
      openAuthSessionAsync: async () => ({ type: "dismiss" }),
      maybeCompleteAuthSession: () => ({ type: "failed" }),
      warmUpAsync: async () => undefined,
      coolDownAsync: async () => undefined,
    },
  ],
  [
    /^expo-updates$/,
    {
      checkForUpdateAsync: async () => ({ isAvailable: false }),
      fetchUpdateAsync: async () => ({ isNew: false }),
      reloadAsync: async () => undefined,
      isEnabled: false,
      channel: "test",
      updateId: null,
    },
  ],
  [
    /^expo-linking$/,
    {
      openURL: async () => true,
      canOpenURL: async () => true,
      createURL: (path) => `hungry://${path}`,
      getInitialURL: async () => null,
      addEventListener: () => ({ remove() {} }),
      parse: (url) => ({ path: url, queryParams: {} }),
    },
  ],
  [
    /^expo-device$/,
    {
      isDevice: false,
      brand: "test",
      modelName: "test",
      osName: "test",
      osVersion: "0",
      deviceType: 1,
    },
  ],
  [/^expo-(?!asset$)[a-z-]+$/, {}],
];

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  for (const [pattern, overrides] of STUBS) {
    if (pattern.test(request)) {
      if (overrides.__raw === true) return overrides;
      const key = `${request}`;
      load.cache = load.cache || new Map();
      if (!load.cache.has(key)) load.cache.set(key, createStub(request, overrides));
      return load.cache.get(key);
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...rest) {
  if (request === "react-native" || request.startsWith("react-native/")) {
    return originalResolve.call(
      this,
      request.replace(/^react-native/, "react-native-web"),
      ...rest,
    );
  }
  return originalResolve.call(this, request, ...rest);
};

// Images, audio and fonts are `require`d for their asset id in React Native; any value will do here.
for (const extension of [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".mp3",
  ".mp4",
  ".ttf",
  ".otf",
  ".json5",
]) {
  Module._extensions[extension] = (module, filename) => {
    module.exports = {
      uri: `asset://${require("node:path").basename(filename)}`,
      width: 100,
      height: 100,
    };
  };
}
