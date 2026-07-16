import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.HUNGRY_WEB_RUNTIME_PORT || 3316);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  throw new Error("HUNGRY_WEB_RUNTIME_PORT must be a safe integer between 1024 and 65535.");
}

const baseUrl = `http://${host}:${port}`;
const evidenceDir = path.resolve(
  process.env.CSP_EVIDENCE_DIR || path.join(tmpdir(), "hungry-web-runtime-ci"),
);
mkdirSync(evidenceDir, { recursive: true });

const runtimeEnv = {
  ...process.env,
  CSP_EVIDENCE_DIR: evidenceDir,
  HUNGRY_CONSOLE_BASIC_AUTH_PASSWORD: "",
  HUNGRY_CONSOLE_BASIC_AUTH_USERNAME: "",
  HUNGRY_CONSOLE_BREAK_GLASS_ENABLED: "0",
  HUNGRY_CONSOLE_PASSWORD: "",
  HUNGRY_CONSOLE_USERNAME: "",
  HUNGRY_MERCHANT_ACCESS_TOKEN: "",
  HUNGRY_MERCHANT_PORTAL_ENABLED: "0",
  HUNGRY_REQUIRE_PRIVATE_ROUTE_QC: "0",
  NEXT_DISABLE_SWC: "1",
  WEBSITE_BASE_URL: baseUrl,
};

let serverExit = null;
const server = spawn(
  process.execPath,
  [
    path.resolve("node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    host,
    "--port",
    String(port),
  ],
  { cwd: process.cwd(), env: runtimeEnv, stdio: "inherit" },
);
server.once("exit", (code, signal) => {
  serverExit = { code, signal };
});

function runGate(script) {
  console.log(`\n==> npm run ${script}`);
  const result = spawnSync("npm", ["run", script], {
    env: runtimeEnv,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

async function waitForServer() {
  for (let attempt = 1; attempt <= 90; attempt += 1) {
    if (serverExit) {
      throw new Error(
        `Production server exited before readiness (code ${serverExit.code}, signal ${serverExit.signal}).`,
      );
    }
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status === 200) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Production server did not become ready at ${baseUrl} within 90 seconds.`);
}

async function stopServer() {
  if (serverExit) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (!serverExit) server.kill("SIGKILL");
}

try {
  await waitForServer();
  for (const script of ["security:browser", "private-routes:qc", "seo:links", "a11y:keyboard"]) {
    runGate(script);
  }
  console.log(`\nWebsite runtime CI gates passed against ${baseUrl}.`);
} finally {
  await stopServer();
}
