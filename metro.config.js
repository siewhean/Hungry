const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

const config = mergeConfig(getDefaultConfig(__dirname), getSentryExpoConfig(__dirname));

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@": path.resolve(__dirname, "src"),
};

// Metro treats `@/foo` as a scoped package request, so `extraNodeModules["@"]`
// alone is not sufficient for production/native bundling. Resolve the alias
// explicitly while preserving any upstream resolver installed by Sentry.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolvedModuleName = moduleName.startsWith("@/")
    ? path.resolve(__dirname, "src", moduleName.slice(2))
    : moduleName;

  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, resolvedModuleName, platform);
  }
  return context.resolveRequest(context, resolvedModuleName, platform);
};

config.transformer.babelTransformerPath = path.join(
  __dirname,
  "scripts/metro-babel-transformer.cjs",
);

if (process.env.HUNGRY_METRO_USE_WATCHMAN === "0") {
  config.resolver.useWatchman = false;
}

module.exports = config;
