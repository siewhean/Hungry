#!/usr/bin/env node
/**
 * Batch field-kit intake CLI — Package 1.2.
 *
 * Classifies one stall folder (<venue-id>/ containing front.*, menu*.*, hours.txt / hours.*,
 * halal*.*, dish*.*), generates <=1600px main JPEGs + 480px thumbnails so uploads respect the
 * Supabase Free 1 GB storage / 5 GB egress caps, parses unambiguous 7-day hours.txt via
 * parseHoursTextToSchedule, and (with --apply) uploads menu photos, invokes submit_menu_photo +
 * ingest-menu-photo, writes opening_schedule when null, and prints the Console review URL.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as openingScheduleMod from "../../src/utils/openingSchedule.ts";

const parseHoursTextToSchedule =
  openingScheduleMod.parseHoursTextToSchedule ??
  openingScheduleMod.default?.parseHoursTextToSchedule;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".webp"]);

export function classifyStallFolderEntries(filenames) {
  const result = {
    front: [],
    menus: [],
    hoursPhotos: [],
    hoursTextFile: null,
    halalCerts: [],
    dishes: [],
    ignored: [],
  };

  for (const name of [...filenames].sort((a, b) => a.localeCompare(b))) {
    if (name.startsWith(".")) continue;
    const ext = path.extname(name).toLowerCase();
    const stem = path.basename(name, path.extname(name)).toLowerCase();

    if (name.toLowerCase() === "hours.txt") {
      result.hoursTextFile = name;
      continue;
    }
    if (!IMAGE_EXTENSIONS.has(ext)) {
      result.ignored.push(name);
      continue;
    }
    if (stem === "front" || stem.startsWith("front-") || stem.startsWith("front_")) {
      result.front.push(name);
    } else if (stem === "menu" || stem.startsWith("menu-") || stem.startsWith("menu_")) {
      result.menus.push(name);
    } else if (stem === "hours" || stem.startsWith("hours-") || stem.startsWith("hours_")) {
      result.hoursPhotos.push(name);
    } else if (stem === "halal" || stem.startsWith("halal-") || stem.startsWith("halal_")) {
      result.halalCerts.push(name);
    } else if (stem === "dish" || stem.startsWith("dish-") || stem.startsWith("dish_")) {
      result.dishes.push(name);
    } else {
      result.ignored.push(name);
    }
  }
  return result;
}

/**
 * Resizes an input image to JPEG at `maxEdgePx` using macOS `sips` or `ffmpeg` (Linux/CI),
 * failing closed if conversion is unavailable or fails so raw PNG/HEIC bytes are never uploaded
 * under `image/jpeg`. Custom `resizer` remains supported for unit tests.
 */
export function prepareResizedVariants(inputPath, outDir, baseSlug, resizer) {
  const mainPath = path.join(outDir, `${baseSlug}.1600w.jpg`);
  const thumbPath = path.join(outDir, `${baseSlug}.480w.jpg`);

  if (typeof resizer === "function") {
    resizer(inputPath, mainPath, 1600);
    resizer(inputPath, thumbPath, 480);
  } else if (process.platform === "darwin" && fs.existsSync("/usr/bin/sips")) {
    const r1 = spawnSync(
      "/usr/bin/sips",
      [
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        "78",
        "-Z",
        "1600",
        inputPath,
        "--out",
        mainPath,
      ],
      { encoding: "utf8", stdio: "pipe" },
    );
    const r2 = spawnSync(
      "/usr/bin/sips",
      [
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        "72",
        "-Z",
        "480",
        inputPath,
        "--out",
        thumbPath,
      ],
      { encoding: "utf8", stdio: "pipe" },
    );
    if (
      r1.status !== 0 ||
      r2.status !== 0 ||
      !fs.existsSync(mainPath) ||
      !fs.existsSync(thumbPath)
    ) {
      throw new Error(
        `sips JPEG conversion failed for ${inputPath}: ${(r1.stderr || r2.stderr || "").trim()}`,
      );
    }
  } else {
    const ff1 = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        inputPath,
        "-vf",
        "scale='min(1600,iw)':-2",
        "-q:v",
        "4",
        mainPath,
      ],
      { encoding: "utf8", stdio: "pipe" },
    );
    const ff2 = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        inputPath,
        "-vf",
        "scale='min(480,iw)':-2",
        "-q:v",
        "5",
        thumbPath,
      ],
      { encoding: "utf8", stdio: "pipe" },
    );
    if (
      ff1.status !== 0 ||
      ff2.status !== 0 ||
      !fs.existsSync(mainPath) ||
      !fs.existsSync(thumbPath)
    ) {
      throw new Error(
        `Image conversion to JPEG failed for ${inputPath}. Install macOS sips or ffmpeg before running field-kit ingest.`,
      );
    }
  }

  return {
    mainPath,
    mainBytes: fs.statSync(mainPath).size,
    thumbPath,
    thumbBytes: fs.statSync(thumbPath).size,
  };
}

export function planStallFolderIngest(folderPath, options = {}) {
  const resolvedFolder = path.resolve(folderPath);
  if (!fs.existsSync(resolvedFolder) || !fs.statSync(resolvedFolder).isDirectory()) {
    throw new Error(`Stall folder does not exist: ${resolvedFolder}`);
  }

  const venueId = (options.venueId ?? path.basename(resolvedFolder)).trim();
  if (!venueId || venueId.includes("/") || venueId.includes("..")) {
    throw new Error(`Invalid venueId derived from folder: ${venueId}`);
  }

  const entries = fs.readdirSync(resolvedFolder);
  const classified = classifyStallFolderEntries(entries);

  let hoursRaw = null;
  let openingSchedule = null;
  let hoursStatus = "none";
  if (classified.hoursTextFile) {
    hoursRaw = fs.readFileSync(path.join(resolvedFolder, classified.hoursTextFile), "utf8").trim();
    if (hoursRaw) {
      openingSchedule = parseHoursTextToSchedule(hoursRaw);
      hoursStatus = openingSchedule ? "parsed" : "unclear_skipped";
    }
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "hungry-field-kit-"));
  try {
    const allImages = [
      ...classified.front.map((file) => ({ kind: "front", file })),
      ...classified.menus.map((file) => ({ kind: "menu", file })),
      ...classified.hoursPhotos.map((file) => ({ kind: "hours_photo", file })),
      ...classified.halalCerts.map((file) => ({ kind: "halal_cert", file })),
      ...classified.dishes.map((file) => ({ kind: "dish", file })),
    ];

    const preparedImages = allImages.map((item, idx) => {
      const safeStem = path
        .basename(item.file, path.extname(item.file))
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-");
      const variants = prepareResizedVariants(
        path.join(resolvedFolder, item.file),
        workDir,
        `${String(idx + 1).padStart(2, "0")}-${safeStem}`,
        options.resizer,
      );
      return {
        ...item,
        safeStem,
        mainBytes: variants.mainBytes,
        thumbBytes: variants.thumbBytes,
      };
    });

    const consoleBase = (options.consoleBaseUrl ?? "https://usehungry.com").replace(/\/$/, "");
    return {
      venueId,
      classified,
      hoursStatus,
      hoursRaw,
      openingSchedule,
      preparedImages,
      consoleReviewUrl: `${consoleBase}/console/stall-submissions?q=${encodeURIComponent(venueId)}`,
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export async function applyStallFolderIngest(folderPath, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const supabaseUrl = (options.supabaseUrl ?? process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const anonKey = options.anonKey ?? process.env.SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const operatorToken = options.operatorToken ?? process.env.HUNGRY_OPERATOR_ACCESS_TOKEN ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !operatorToken) {
    throw new Error(
      "Missing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, or HUNGRY_OPERATOR_ACCESS_TOKEN for --apply.",
    );
  }

  const userRes = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${operatorToken}` },
  });
  if (!userRes.ok) {
    throw new Error(`Operator token check failed (${userRes.status})`);
  }
  const userJson = await userRes.json();
  const userId = userJson?.id;
  if (typeof userId !== "string" || !userId) {
    throw new Error("Operator token did not resolve to a valid user ID.");
  }

  const resolvedFolder = path.resolve(folderPath);
  const venueId = (options.venueId ?? path.basename(resolvedFolder)).trim();
  const entries = fs.readdirSync(resolvedFolder);
  const classified = classifyStallFolderEntries(entries);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "hungry-field-kit-apply-"));

  try {
    const submissions = [];
    for (let i = 0; i < classified.menus.length; i += 1) {
      const file = classified.menus[i];
      const safeStem = path
        .basename(file, path.extname(file))
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-");
      const variants = prepareResizedVariants(
        path.join(resolvedFolder, file),
        workDir,
        `menu-${i + 1}-${safeStem}`,
        options.resizer,
      );
      const mainBytes = fs.readFileSync(variants.mainPath);
      const thumbBytes = fs.readFileSync(variants.thumbPath);
      const stamp = Date.now();
      const storagePath = `${userId}/${venueId}/${stamp}-${safeStem}.jpg`;
      const thumbStoragePath = `${userId}/${venueId}/${stamp}-${safeStem}.480w.jpg`;

      for (const [destPath, buf] of [
        [storagePath, mainBytes],
        [thumbStoragePath, thumbBytes],
      ]) {
        const upRes = await fetchImpl(`${supabaseUrl}/storage/v1/object/menu-photos/${destPath}`, {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
          },
          body: buf,
        });
        if (!upRes.ok) {
          throw new Error(`Storage upload failed for ${destPath} (${upRes.status})`);
        }
      }

      const submitRes = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/submit_menu_photo`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${operatorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_venue_id: venueId,
          p_storage_path: storagePath,
          p_content_type: "image/jpeg",
          p_size_bytes: mainBytes.byteLength,
        }),
      });
      if (!submitRes.ok) {
        throw new Error(`submit_menu_photo failed (${submitRes.status})`);
      }
      const submissionId = await submitRes.json();

      const ocrRes = await fetchImpl(`${supabaseUrl}/functions/v1/ingest-menu-photo`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${operatorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ submissionId }),
      });
      if (!ocrRes.ok) {
        throw new Error(`ingest-menu-photo failed (${ocrRes.status})`);
      }
      submissions.push(await ocrRes.json());
    }

    let scheduleApplied = false;
    if (classified.hoursTextFile) {
      const hoursRaw = fs
        .readFileSync(path.join(resolvedFolder, classified.hoursTextFile), "utf8")
        .trim();
      const schedule = hoursRaw ? parseHoursTextToSchedule(hoursRaw) : null;
      if (schedule) {
        const patchRes = await fetchImpl(
          `${supabaseUrl}/rest/v1/venues?id=eq.${encodeURIComponent(venueId)}&opening_schedule=is.null`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({ opening_schedule: schedule }),
          },
        );
        if (!patchRes.ok) {
          throw new Error(`opening_schedule update failed (${patchRes.status})`);
        }
        const updatedRows = await patchRes.json();
        scheduleApplied = Array.isArray(updatedRows) && updatedRows.length > 0;
      }
    }

    const consoleBase = (options.consoleBaseUrl ?? "https://usehungry.com").replace(/\/$/, "");
    return {
      venueId,
      submissions,
      scheduleApplied,
      consoleReviewUrl: `${consoleBase}/console/stall-submissions?q=${encodeURIComponent(venueId)}`,
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function main(argv) {
  const args = [...argv];
  let apply = false;
  let venueId;
  let folderPath = "";

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--apply") {
      apply = true;
    } else if (arg === "--venue") {
      venueId = args.shift();
    } else if (!folderPath && arg && !arg.startsWith("-")) {
      folderPath = arg;
    } else {
      throw new Error(
        `Usage: ingest-stall-folder.mjs <stall-folder> [--venue <venue-id>] [--apply]`,
      );
    }
  }

  if (!folderPath) {
    throw new Error(`Usage: ingest-stall-folder.mjs <stall-folder> [--venue <venue-id>] [--apply]`);
  }

  if (!apply) {
    const plan = planStallFolderIngest(folderPath, { venueId });
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", ...plan }, null, 2)}\n`);
    return;
  }

  const applied = await applyStallFolderIngest(folderPath, { venueId });
  process.stdout.write(`${JSON.stringify({ mode: "applied", ...applied }, null, 2)}\n`);
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
