const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

const config = getSentryExpoConfig(__dirname);

config.transformer.babelTransformerPath = path.join(__dirname, "scripts/metro-babel-transformer.cjs");

module.exports = config;
