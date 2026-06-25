const baseConfig = require("./app.config.base.json").expo;

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

module.exports = () => {
  const resolvedConfig = clone(baseConfig);
  const appEnv = resolveAppEnv();
  const isProduction = appEnv === "production";

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
    new Set(["expo-dev-client", "expo-audio"])
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
