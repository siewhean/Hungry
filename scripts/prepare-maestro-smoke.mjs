#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const MAESTRO_URL =
  "https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip";
const TEMURIN_17_URLS = {
  arm64: "https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse",
  x64: "https://api.adoptium.net/v3/binary/latest/17/ga/mac/x64/jdk/hotspot/normal/eclipse",
};

const defaultCacheRoot =
  process.platform === "darwin"
    ? "/private/tmp/hungry-native-smoke-tools"
    : join(tmpdir(), "hungry-native-smoke-tools");
const cacheRoot =
  process.env.HUNGRY_NATIVE_SMOKE_CACHE_DIR?.trim() ||
  defaultCacheRoot;
const maestroRoot = join(cacheRoot, "maestro");
const jdkRoot = join(cacheRoot, "jdk17");
const toolHome = join(cacheRoot, "home");

function fail(message) {
  throw new Error(`[prepare-maestro-smoke] ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: options.env ?? process.env,
    cwd: options.cwd ?? process.cwd(),
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    fail(
      `${command} ${args.join(" ")} failed` +
        (stderr ? `\n${stderr}` : "") +
        (stdout ? `\n${stdout}` : ""),
    );
  }
  return result;
}

function canRun(command, args, env = process.env) {
  const result = spawnSync(command, args, { encoding: "utf8", env });
  return result.status === 0;
}

function javaMajor(env = process.env) {
  const result = spawnSync("java", ["-version"], { encoding: "utf8", env });
  if (result.status !== 0) return 0;
  const output = `${result.stderr}\n${result.stdout}`;
  const match = output.match(/version "(\d+)(?:\.\d+)?/);
  return match ? Number(match[1]) : 0;
}

function download(url, outputPath) {
  if (existsSync(outputPath)) return;
  const partialPath = `${outputPath}.download`;
  rmSync(partialPath, { force: true });
  run("curl", ["--fail", "--location", "--progress-bar", url, "-o", partialPath], {
    stdio: "inherit",
  });
  renameSync(partialPath, outputPath);
}

function ensureMaestro() {
  if (canRun("maestro", ["--version"])) return null;

  mkdirSync(maestroRoot, { recursive: true });
  const zipPath = join(maestroRoot, "maestro.zip");
  const extractedBin = join(maestroRoot, "extracted", "maestro", "bin", "maestro");
  download(MAESTRO_URL, zipPath);
  if (!existsSync(extractedBin)) {
    mkdirSync(join(maestroRoot, "extracted"), { recursive: true });
    run("unzip", ["-qo", zipPath, "-d", join(maestroRoot, "extracted")], { stdio: "inherit" });
  }
  if (!existsSync(extractedBin)) {
    fail(`Maestro binary was not found after extraction: ${extractedBin}`);
  }
  return extractedBin;
}

function findJdkHome() {
  if (!existsSync(jdkRoot)) return null;
  for (const entry of readdirSync(jdkRoot)) {
    const candidate = join(jdkRoot, entry, "Contents", "Home");
    if (existsSync(join(candidate, "bin", "java"))) return candidate;
  }
  return null;
}

function ensureJava17(baseEnv) {
  if (javaMajor(baseEnv) >= 17) return null;

  mkdirSync(jdkRoot, { recursive: true });
  const jdkHome = findJdkHome();
  if (jdkHome) return jdkHome;

  const url = TEMURIN_17_URLS[process.arch];
  if (!url || process.platform !== "darwin") {
    fail("Java 17 is required; automatic JDK setup is only supported on macOS arm64/x64");
  }

  const tarPath = join(jdkRoot, "jdk17.tar.gz");
  download(url, tarPath);
  run("tar", ["-xzf", tarPath, "-C", jdkRoot], { stdio: "inherit" });
  const extractedHome = findJdkHome();
  if (!extractedHome) {
    fail(`Java 17 home was not found after extraction in ${jdkRoot}`);
  }
  return extractedHome;
}

function main() {
  const target = process.argv[2] ?? "ios";
  mkdirSync(cacheRoot, { recursive: true });
  mkdirSync(toolHome, { recursive: true });

  const maestroBin = ensureMaestro();
  const maestroBinDir = maestroBin ? resolve(maestroBin, "..") : "";
  const basePath = [maestroBinDir, process.env.PATH].filter(Boolean).join(":");
  const envForJava = { ...process.env, PATH: basePath };
  const jdkHome = ensureJava17(envForJava);
  const finalPath = [jdkHome ? join(jdkHome, "bin") : "", maestroBinDir, process.env.PATH]
    .filter(Boolean)
    .join(":");

  const result = spawnSync("node", ["scripts/run-maestro-smoke.mjs", target, "--require-maestro"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    env: {
      ...process.env,
      PATH: finalPath,
      ...(jdkHome ? { JAVA_HOME: jdkHome } : {}),
      JAVA_TOOL_OPTIONS: `-Duser.home=${toolHome}`,
      MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true",
      MAESTRO_CLI_NO_ANALYTICS: "1",
      HUNGRY_MAESTRO_REQUIRED: "1",
    },
  });

  process.exit(result.status ?? 1);
}

main();
