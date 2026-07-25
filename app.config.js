const baseConfig = require("./app.json").expo;

const RELEASED_ANDROID_PERMISSIONS = [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.INTERNET",
  "android.permission.VIBRATE",
];

const RELEASED_NATIVE_MODULES = new Set([
  "expo-dev-client",
  "expo-audio",
  "expo-video",
  "@rnmapbox/maps",
]);

const RELEASED_INFO_PLIST_KEYS = [
  "DEV_CLIENT_TRY_TO_LAUNCH_LAST_BUNDLE",
  "NSBonjourServices",
  "NSLocalNetworkUsageDescription",
  "NSLocationAlwaysUsageDescription",
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "NSFaceIDUsageDescription",
  "NSCameraUsageDescription",
  "NSMicrophoneUsageDescription",
  "NSPhotoLibraryAddUsageDescription",
  "UIBackgroundModes",
  "CADisableMinimumFrameDurationOnPhone",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveAppEnv() {
  const raw = process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || process.env.NODE_ENV;
  if (raw === "production" || raw === "staging" || raw === "development") {
    return raw;
  }
  return "development";
}

function hasExplicitAppEnv() {
  const raw = process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || process.env.NODE_ENV;
  return raw === "production" || raw === "staging" || raw === "development";
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function withoutPlugins(plugins, blockedNames) {
  return plugins.filter((plugin) => !blockedNames.has(pluginName(plugin)));
}

function withSentryPluginEnv(plugins) {
  return plugins.map((plugin) => {
    if (pluginName(plugin) !== "@sentry/react-native/expo") {
      return plugin;
    }

    const existingOptions = Array.isArray(plugin) && plugin[1] ? plugin[1] : {};
    const options = {
      ...existingOptions,
      url: existingOptions.url || "https://sentry.io/",
      organization: process.env.SENTRY_ORG || existingOptions.organization,
      project: process.env.SENTRY_PROJECT || existingOptions.project,
    };

    return ["@sentry/react-native/expo", options];
  });
}

function withReleasedImagePicker(plugins) {
  return plugins.map((plugin) => {
    if (pluginName(plugin) !== "expo-image-picker") return plugin;
    const existingOptions = Array.isArray(plugin) && plugin[1] ? plugin[1] : {};
    return ["expo-image-picker", { photosPermission: existingOptions.photosPermission }];
  });
}

module.exports = ({ config } = {}) => {
  const sourceConfig = config && Object.keys(config).length ? config : baseConfig;
  const resolvedConfig = sourceConfig === config ? { ...config } : clone(baseConfig);
  const appEnv = resolveAppEnv();
  const isReleasedProfile = appEnv === "staging" || appEnv === "production";

  resolvedConfig.plugins = withSentryPluginEnv(resolvedConfig.plugins || []);

  if (hasExplicitAppEnv()) {
    resolvedConfig.extra = {
      ...(resolvedConfig.extra || {}),
      appEnv,
      e2eDeveloperLauncherEnabled:
        appEnv === "development" &&
        process.env.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE === "mock" &&
        process.env.HUNGRY_EXPO_E2E_WEBSERVER === "1",
    };
  }

  if (!isReleasedProfile) {
    return resolvedConfig;
  }

  resolvedConfig.plugins = withoutPlugins(resolvedConfig.plugins || [], RELEASED_NATIVE_MODULES);
  resolvedConfig.plugins = withReleasedImagePicker(resolvedConfig.plugins);

  resolvedConfig.android = {
    ...(resolvedConfig.android || {}),
    permissions: RELEASED_ANDROID_PERMISSIONS,
  };

  resolvedConfig.ios = {
    ...(resolvedConfig.ios || {}),
    infoPlist: {
      ...((resolvedConfig.ios && resolvedConfig.ios.infoPlist) || {}),
    },
  };

  const releasedInfoPlist = resolvedConfig.ios.infoPlist;
  for (const key of RELEASED_INFO_PLIST_KEYS) {
    delete releasedInfoPlist[key];
  }

  return resolvedConfig;
};
