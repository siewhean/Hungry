import { spawnSync } from "node:child_process";

const profile = process.argv[2];
const isPrintConfig = process.argv.includes("--print-config");
const releasedProfiles = {
  "internal-alpha": { appEnv: "staging", channel: "internal-alpha", environment: "preview" },
  preview: { appEnv: "staging", channel: "preview", environment: "preview" },
  production: { appEnv: "production", channel: "production", environment: "production" },
};
const release = releasedProfiles[profile];

if (!release) {
  process.stderr.write(
    "Usage: node scripts/publish-eas-update.mjs <internal-alpha|preview|production> [--print-config]\n",
  );
  process.exit(1);
}

const environment = {
  ...process.env,
  EXPO_NO_DOTENV: "1",
  EXPO_PUBLIC_APP_ENV: release.appEnv,
  EXPO_PUBLIC_HUNGRY_DATA_SOURCE: "supabase",
};
delete environment.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE;
delete environment.HUNGRY_EXPO_E2E_WEBSERVER;

if (isPrintConfig) {
  process.stdout.write(
    `${JSON.stringify({
      appEnv: environment.EXPO_PUBLIC_APP_ENV,
      channel: release.channel,
      environment: release.environment,
      e2eDataSource: environment.EXPO_PUBLIC_HUNGRY_E2E_DATA_SOURCE ?? null,
      e2eWebserver: environment.HUNGRY_EXPO_E2E_WEBSERVER ?? null,
      source: environment.EXPO_PUBLIC_HUNGRY_DATA_SOURCE,
    })}\n`,
  );
  process.exit(0);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "--yes",
    "eas-cli@21.1.0",
    "update",
    "--environment",
    release.environment,
    "--channel",
    release.channel,
    "--message",
    process.env.npm_config_msg || `${release.channel} update`,
  ],
  { env: environment, stdio: "inherit" },
);

process.exit(result.status ?? 1);
