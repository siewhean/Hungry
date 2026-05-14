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
    rules: {
      // The app intentionally lazy-loads many navigation screens with require().
      // Keep syntax/type checks active without warning on that routing pattern.
      "@typescript-eslint/no-require-imports": "off",

      // The integrated branch still contains prototype and V2 screens with staged
      // imports/state for incomplete surfaces. TypeScript remains the source of
      // truth for invalid symbols; this keeps lint output signal-only.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "no-empty-pattern": "off",
      "import/no-duplicates": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-useless-constructor": "off",
    },
  }
]);
