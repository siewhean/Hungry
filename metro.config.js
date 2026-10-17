const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

// getSentryExpoConfig extends expo/metro-config, which resolves the tsconfig "@/..." paths.
const config = getSentryExpoConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@": path.resolve(__dirname, "src"),
};

config.transformer.babelTransformerPath = path.join(
  __dirname,
  "scripts/metro-babel-transformer.cjs",
);

if (process.env.HUNGRY_METRO_USE_WATCHMAN === "0") {
  config.resolver.useWatchman = false;
}

module.exports = config;
