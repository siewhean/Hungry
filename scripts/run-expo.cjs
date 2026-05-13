const fs = require("fs");
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

function runWithNode(nodeBinary) {
  const expoCli = path.join(projectRoot, "node_modules", "expo", "bin", "cli");
  if (!fs.existsSync(expoCli)) {
    console.error("Missing local Expo CLI at node_modules/expo/bin/cli. Run npm install first.");
    process.exit(1);
  }

  maybeKillStaleIosBuilds();

  const result = spawnSync(nodeBinary, [expoCli, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: projectRoot,
    env: process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function maybeKillStaleIosBuilds() {
  const args = process.argv.slice(2);
  if (args[0] !== "run:ios") {
    return;
  }

  const markers = [
    "run-expo.cjs run:ios",
    "xcodebuild -workspace ios/Hungry.xcworkspace",
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

const currentNodeMajor = Number(process.versions.node.split(".")[0]);

if (!SUPPORTED_NODE_MAJORS.has(currentNodeMajor)) {
  const preferredNode = findPreferredNode();
  if (!preferredNode) {
    console.error(
      `Unsupported Node.js ${process.versions.node}. Hungry requires Node 20-22 for Expo 55 tooling. Install or activate Node 22, then rerun.`
    );
    process.exit(1);
  }

  runWithNode(preferredNode);
}

runWithNode(process.execPath);
