// Import this first in a render test that needs the production feature flags (parties off, and so
// on). The flags are read when `@/constants/featureFlags` loads, which is why it must come first.
process.env.EXPO_PUBLIC_APP_ENV = "production";
