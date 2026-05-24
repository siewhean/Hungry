const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

const config = getSentryExpoConfig(__dirname);

config.transformer.babelTransformerPath = path.join(
  __dirname,
  "scripts/metro-babel-transformer.cjs",
);

if (process.env.HUNGRY_METRO_USE_WATCHMAN === "0") {
  config.resolver.useWatchman = false;
}

module.exports = config;
