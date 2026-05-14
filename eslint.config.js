// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      ".venv/**",
      "venv/**",
      "__pycache__/**",
      ".claude/**",
      "output/**",
      "changes/**",
      ".expo/**",
      ".next/**",
      "coverage/**",
      "store-layout-editor/**",
      "figma-plugin/**",
      "marketing/website/web-v2/**",
      "ios/**",
      "android/**",
    ],
  }
]);
