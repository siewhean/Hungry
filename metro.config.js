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

// Production always reads from Supabase, so keep the mock service, mock fixtures and the
// 9.4 MB Excel catalog out of production bundles by resolving their entry modules to a stub.
// Their only non-test importers are serviceProvider.ts and the __DEV__-only DeveloperLauncher.
if (process.env.EXPO_PUBLIC_APP_ENV === "production") {
  const servicesDir = path.join(__dirname, "src/lib/services");
  const productionStubbedModules = new Set(
    [
      "mock/mockService.ts",
      "mock/repositories.ts",
      "mock/data.ts",
      "excel/excelService.ts",
      "excel/repositories.ts",
      "excel/excelCatalog.generated.json",
    ].map((file) => path.join(servicesDir, file)),
  );
  const releaseBundleStub = path.join(servicesDir, "excel/releaseBundleStub.js");
  const upstreamResolveRequest = config.resolver.resolveRequest;

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolution = upstreamResolveRequest
      ? upstreamResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
    if (resolution.type === "sourceFile" && productionStubbedModules.has(resolution.filePath)) {
      return { type: "sourceFile", filePath: releaseBundleStub };
    }
    return resolution;
  };
}

if (process.env.HUNGRY_METRO_USE_WATCHMAN === "0") {
  config.resolver.useWatchman = false;
}

module.exports = config;
