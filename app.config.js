const baseConfig = require("./app.json").expo;

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

module.exports = ({ config } = {}) => {
  const sourceConfig = config && Object.keys(config).length ? config : baseConfig;
  const resolvedConfig = sourceConfig === config ? { ...config } : clone(baseConfig);
  const appEnv = resolveAppEnv();
  const isProduction = appEnv === "production";

  resolvedConfig.plugins = withSentryPluginEnv(resolvedConfig.plugins || []);
  if (!resolvedConfig.plugins.some((plugin) => pluginName(plugin) === "expo-sharing")) resolvedConfig.plugins.push("expo-sharing");

  if (hasExplicitAppEnv()) {
    resolvedConfig.extra = {
      ...(resolvedConfig.extra || {}),
      appEnv,
    };
  }

  if (!isProduction) {
    return resolvedConfig;
  }

  resolvedConfig.plugins = withoutPlugins(
    resolvedConfig.plugins || [],
    new Set(["expo-dev-client", "expo-audio"]),
  );

  resolvedConfig.ios = {
    ...(resolvedConfig.ios || {}),
    infoPlist: {
      ...((resolvedConfig.ios && resolvedConfig.ios.infoPlist) || {}),
    },
  };

  const productionInfoPlist = resolvedConfig.ios.infoPlist;
  delete productionInfoPlist.DEV_CLIENT_TRY_TO_LAUNCH_LAST_BUNDLE;
  delete productionInfoPlist.NSBonjourServices;
  delete productionInfoPlist.NSLocalNetworkUsageDescription;
  delete productionInfoPlist.NSLocationAlwaysUsageDescription;
  delete productionInfoPlist.NSLocationAlwaysAndWhenInUseUsageDescription;
  delete productionInfoPlist.NSFaceIDUsageDescription;
  delete productionInfoPlist.UIBackgroundModes;
  delete productionInfoPlist.CADisableMinimumFrameDurationOnPhone;

  return resolvedConfig;
};
