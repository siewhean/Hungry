const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const SUPPORTED_NODE_MAJORS = new Set([20, 21, 22]);
const projectRoot = path.join(__dirname, "..");

function findPreferredNode() {
  const home = os.homedir();
  const nvmVersionsDir = path.join(home, ".nvm", "versions", "node");
  if (!fs.existsSync(nvmVersionsDir)) {
    return null;
  }

  const candidates = fs
    .readdirSync(nvmVersionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v(22|21|20)\./.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      binary: path.join(nvmVersionsDir, entry.name, "bin", "node"),
    }))
    .filter((entry) => fs.existsSync(entry.binary))
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));

  return candidates[0]?.binary ?? null;
}

async function runWithNode(nodeBinary) {
  const expoCli = path.join(projectRoot, "node_modules", "expo", "bin", "cli");
  if (!fs.existsSync(expoCli)) {
    console.error("Missing local Expo CLI at node_modules/expo/bin/cli. Run npm install first.");
    process.exit(1);
  }

  maybeKillStaleIosBuilds();

  const args = process.argv.slice(2);
  const env = { ...process.env };
  await assertNonInteractiveStartPortAvailableAsync(args, env);

  const result = spawnSync(nodeBinary, [expoCli, ...args], {
    stdio: "inherit",
    cwd: projectRoot,
    env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function getStartPort(args) {
  if (args[0] !== "start") {
    return null;
  }

  const rawPort = getArgValue(args, "--port", "-p") ?? process.env.RCT_METRO_PORT;
  if (!rawPort) {
    return null;
  }

  const port = Number(rawPort);
  return Number.isInteger(port) && port > 0 ? port : null;
}

function getArgValue(args, longName, shortName) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === longName || arg === shortName) {
      return args[index + 1] ?? null;
    }
    if (arg.startsWith(`${longName}=`)) {
      return arg.slice(longName.length + 1);
    }
    if (shortName && arg.startsWith(`${shortName}=`)) {
      return arg.slice(shortName.length + 1);
    }
  }

  return null;
}

function isNonInteractiveStart(env) {
  return (
    env.CI === "1" ||
    env.CI === "true" ||
    env.HUNGRY_EXPO_E2E_WEBSERVER === "1" ||
    env.HUNGRY_EXPO_NON_INTERACTIVE === "1" ||
    !process.stdout.isTTY
  );
}

async function assertNonInteractiveStartPortAvailableAsync(args, env) {
  const port = getStartPort(args);
  if (!port) {
    return;
  }

  env.RCT_METRO_PORT = String(port);

  if (!isNonInteractiveStart(env)) {
    return;
  }

  try {
    await canListenAsync(port, "127.0.0.1");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? ` ${error.code}` : "";
    console.error(
      `Expo startup blocked before launch: cannot listen on 127.0.0.1:${port}${code}. ` +
        "Choose a free E2E_PORT or rerun from an environment with localhost bind access."
    );
    process.exit(1);
  }
}

function canListenAsync(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host, port, exclusive: true }, () => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  });
}

function maybeKillStaleIosBuilds() {
  const args = process.argv.slice(2);
  if (args[0] !== "run:ios") {
    return;
  }

  const markers = [
    "run-expo.cjs run:ios",
    "xcodebuild -workspace ios/Hungry.xcworkspace",
    "xcodebuild -workspace Hungry.xcworkspace",
    "xcodebuild -project ios/Hungry.xcodeproj",
    "xcodebuild -project Hungry.xcodeproj",
    "expo start",
    "metro",
    "react-native start",
  ];

  let output = "";
  try {
    output = execFileSync("ps", ["-ax", "-o", "pid=", "-o", "command="], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return;
  }

  const victims = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/);
      return match ? { pid: Number(match[1]), command: match[2] } : null;
    })
    .filter(Boolean)
    .filter(({ pid, command }) => pid !== process.pid && markers.some((marker) => command.includes(marker)))
    .map(({ pid }) => pid);

  for (const pid of victims) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  }
}

async function main() {
  const currentNodeMajor = Number(process.versions.node.split(".")[0]);

  if (!SUPPORTED_NODE_MAJORS.has(currentNodeMajor)) {
    const preferredNode = findPreferredNode();
    if (!preferredNode) {
      console.error(
        `Unsupported Node.js ${process.versions.node}. Hungry requires Node 20-22 for Expo 55 tooling. Install or activate Node 22, then rerun.`
      );
      process.exit(1);
    }

    await runWithNode(preferredNode);
    return;
  }

  await runWithNode(process.execPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
