#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FORBIDDEN_PRODUCTION_SOURCES = [
  ["mock service or fixtures", "/src/lib/services/mock/"],
  ["generated Excel runtime", "/src/lib/services/excel/"],
  ["developer screens", "/src/app/screens/dev/"],
  ["Wheel screens", "/src/app/screens/wheel/"],
  ["merchant navigator", "/src/app/navigation/MerchantTabs"],
  ["merchant screens", "/src/app/screens/merchant/"],
  ["story viewer", "/src/app/screens/home/StoryViewerScreen"],
  ["story composer", "/src/app/screens/home/AddStoryScreen"],
  ["direct messages", "/src/app/screens/home/DirectMessagesScreen"],
  ["chat detail", "/src/app/screens/home/ChatDetailScreen"],
  ["collections", "/src/app/screens/discover/Collection"],
  ["Passport screen", "/src/app/screens/profile/PassportScreen"],
  ["Missions screen", "/src/app/screens/profile/MissionsScreen"],
  ["checklist prototypes", "/src/app/screens/checklist/"],
  ["portfolio prototypes", "/src/app/screens/portfolio/"],
  ["profile social prototypes", "/src/app/screens/profile/Social"],
  ["Reads prototype", "/src/app/screens/reads/"],
  ["rich-media music picker", "/src/app/screens/review/MusicSelectionScreen"],
  ["prototype splash", "/src/app/screens/SplashScreenV2"],
  ["prototype post composer", "/src/app/screens/post/PostComposerScreenV2"],
  ["prototype floorplan", "/src/app/screens/discover/BuildingDrillDownScreenV2"],
  ["prototype venue directory", "/src/app/screens/discover/VenueDirectoryScreen"],
  ["Passport assets", "/src/assets/gamification/"],
  ["non-production story store", "/src/store/useStoryStore.ts"],
  ["non-production Mission store", "/src/store/useMissionStore.ts"],
  ["non-production Passport store", "/src/store/usePassportStore.ts"],
  ["non-production service provider", "/src/lib/services/serviceProvider.ts"],
  ["non-production root route loaders", "/src/app/navigation/optionalRouteLoaders.ts"],
  [
    "non-production profile route loaders",
    "/src/app/screens/profile/optionalProfileRouteLoaders.ts",
  ],
];

export const REQUIRED_PRODUCTION_SOURCES = [
  "/src/lib/services/serviceProvider.production.ts",
  "/src/app/navigation/optionalRouteLoaders.production.ts",
  "/src/app/screens/profile/optionalProfileRouteLoaders.production.ts",
  "/src/store/useStoryStore.production.ts",
  "/src/store/useMissionStore.production.ts",
  "/src/store/usePassportStore.production.ts",
  "/src/lib/services/supabase/supabaseRepository.ts",
  "/src/lib/services/supabase/supabaseService.ts",
];

async function walk(directory, files = []) {
  for (const entry of await readdir(directory)) {
    const absolutePath = path.join(directory, entry);
    const entryStat = await stat(absolutePath);
    if (entryStat.isDirectory()) {
      await walk(absolutePath, files);
    } else {
      files.push(absolutePath);
    }
  }
  return files;
}

export function auditSources(sources) {
  const normalizedSources = [...new Set(sources.map((source) => source.replaceAll("\\", "/")))];
  const forbidden = FORBIDDEN_PRODUCTION_SOURCES.flatMap(([label, marker]) =>
    normalizedSources
      .filter((source) => source.includes(marker))
      .map((source) => ({ label, marker, source })),
  );
  const missing = REQUIRED_PRODUCTION_SOURCES.filter(
    (marker) => !normalizedSources.some((source) => source.includes(marker)),
  );
  return { forbidden, missing, sourceCount: normalizedSources.length };
}

export async function auditProductionBundle(directory, platform) {
  const absoluteDirectory = path.resolve(directory);
  const files = await walk(absoluteDirectory);
  const sourceMapFiles = files.filter((file) => file.endsWith(".map"));
  const bytecodeFiles = files.filter((file) => file.endsWith(".hbc"));

  if (sourceMapFiles.length === 0) {
    throw new Error(`No external source map found under ${absoluteDirectory}`);
  }
  if (bytecodeFiles.length === 0) {
    throw new Error(`No Hermes bytecode bundle found under ${absoluteDirectory}`);
  }
  if (platform && !sourceMapFiles.some((file) => file.includes(`/${platform}/`))) {
    throw new Error(`No ${platform} source map found under ${absoluteDirectory}`);
  }

  const sources = [];
  for (const sourceMapFile of sourceMapFiles) {
    const sourceMap = JSON.parse(await readFile(sourceMapFile, "utf8"));
    if (!Array.isArray(sourceMap.sources)) {
      throw new Error(`Source map has no sources array: ${sourceMapFile}`);
    }
    sources.push(...sourceMap.sources);
  }

  return {
    directory: absoluteDirectory,
    platform: platform ?? "unspecified",
    sourceMapFiles,
    bytecodeFiles,
    ...auditSources(sources),
  };
}

function parseArguments(argv) {
  const args = { directory: "", platform: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dir") args.directory = argv[++index] ?? "";
    else if (argv[index] === "--platform") args.platform = argv[++index] ?? "";
  }
  return args;
}

async function main() {
  const { directory, platform } = parseArguments(process.argv.slice(2));
  if (!directory) {
    throw new Error(
      "Usage: node scripts/audit-production-bundle.mjs --dir <expo-export-dir> [--platform ios|android]",
    );
  }

  const result = await auditProductionBundle(directory, platform);
  if (result.forbidden.length > 0 || result.missing.length > 0) {
    for (const finding of result.forbidden) {
      console.error(`FORBIDDEN ${finding.label}: ${finding.source}`);
    }
    for (const marker of result.missing) {
      console.error(`MISSING production boundary: ${marker}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Production bundle audit passed (${result.platform}): ${result.sourceCount} unique mapped sources, ${result.bytecodeFiles.length} Hermes bundle(s).`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
