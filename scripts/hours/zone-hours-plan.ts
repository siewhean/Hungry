/**
 * Plans which stalls get a structured opening schedule (build plan package 1.3). Reads
 * [{ id, name, operating_hours }] from stdin (or a file argument) and prints
 * { updates: [{ id, schedule }], skipped: [{ id, name, hours, reason }], counts }.
 * A line is turned into a schedule only when parseHoursTextToSchedule is sure; the rest are left
 * as they are and show "Hours not confirmed" in the app. Never writes anything itself:
 * scripts/db/fill-zone-hours.sh applies the plan.
 */
import { readFileSync } from "node:fs";

import type { OpeningSchedule } from "../../src/types/domain";
import { parseHoursTextToSchedule } from "../../src/utils/openingSchedule";

export interface ZoneHoursRow {
  id: string;
  name?: string | null;
  operating_hours?: string | null;
}

export interface ZoneHoursPlan {
  updates: { id: string; schedule: OpeningSchedule }[];
  skipped: { id: string; name: string; hours: string; reason: "no_hours" | "unclear" }[];
  counts: { rows: number; updates: number; no_hours: number; unclear: number };
}

export function planZoneHours(rows: readonly ZoneHoursRow[]): ZoneHoursPlan {
  const updates: ZoneHoursPlan["updates"] = [];
  const skipped: ZoneHoursPlan["skipped"] = [];
  for (const row of rows) {
    const hours = (row.operating_hours ?? "").trim();
    const name = row.name ?? "";
    if (!hours) {
      skipped.push({ id: row.id, name, hours, reason: "no_hours" });
      continue;
    }
    const schedule = parseHoursTextToSchedule(hours);
    if (schedule) updates.push({ id: row.id, schedule });
    else skipped.push({ id: row.id, name, hours, reason: "unclear" });
  }
  return {
    updates,
    skipped,
    counts: {
      rows: rows.length,
      updates: updates.length,
      no_hours: skipped.filter((item) => item.reason === "no_hours").length,
      unclear: skipped.filter((item) => item.reason === "unclear").length,
    },
  };
}

if (process.argv[1] && process.argv[1].endsWith("zone-hours-plan.ts")) {
  const input = readFileSync(process.argv[2] ?? 0, "utf8");
  const rows: ZoneHoursRow[] = JSON.parse(input || "[]");
  process.stdout.write(`${JSON.stringify(planZoneHours(rows))}\n`);
}
