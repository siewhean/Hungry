import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ALLOWED_FETCH_HOSTS,
  assertAllowedFetchUrl,
  buildOneMapSearchUrl,
  lookupPostalCode,
  parseOneMapPostalResponse,
} from "@/lib/geo/oneMap";
import type { MerchantOutlet, OpeningSchedule } from "@/types/domain";
import { getVenueOpenState } from "@/utils/operatingHours";
import {
  formatScheduleText,
  getScheduleOpenState,
  getUpcomingSpecialHours,
  scheduleFromHoursText,
  validateOpeningSchedule,
} from "@/utils/openingSchedule";
import { UNVERIFIED_ALLOWED_SCREENS, VERIFIED_ONLY_SCREENS, canManageMenu } from "./merchantGuards";
import { getMerchantOutletStatus, getMerchantOutletStatusLabel } from "./merchantReadiness";
import { validateMerchantProfileUpdates } from "./profileValidation";

function read(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const MIGRATIONS = "supabase/migrations";
/** A Singapore wall-clock time as a Date (SGT is UTC+8). */
const sgt = (iso: string) => new Date(new Date(`${iso}Z`).getTime() - 8 * 60 * 60 * 1000);

const SCHEDULE: OpeningSchedule = {
  weekly: {
    mon: [
      { open: "10:00", close: "14:00" },
      { open: "17:00", close: "21:00" },
    ],
    fri: [{ open: "18:00", close: "02:00" }],
    sat: [{ open: "00:00", close: "24:00" }],
  },
  special: [{ date: "2026-12-25", ranges: [] }],
};

test("decision 25: open now is computed from the weekly schedule in Singapore time", () => {
  // 2026-10-19 is a Monday.
  assert.deepEqual(getScheduleOpenState(SCHEDULE, true, sgt("2026-10-19T12:00:00")), {
    status: "open",
    detail: "Closes 2pm",
  });
  assert.deepEqual(getScheduleOpenState(SCHEDULE, true, sgt("2026-10-19T15:00:00")), {
    status: "closed",
    detail: "Opens 5pm",
  });
  assert.equal(getScheduleOpenState(SCHEDULE, true, sgt("2026-10-20T12:00:00")).status, "closed");
  // Friday 6pm-2am still counts as open at 1am on Saturday.
  assert.deepEqual(getScheduleOpenState(SCHEDULE, true, sgt("2026-10-24T01:00:00")), {
    status: "open",
    detail: "Closes 2am",
  });
  assert.equal(
    getScheduleOpenState(SCHEDULE, true, sgt("2026-10-24T12:00:00")).detail,
    "Open 24 hours",
  );
  // A closure notice always wins.
  assert.equal(getScheduleOpenState(SCHEDULE, false, sgt("2026-10-19T12:00:00")).status, "closed");
});

test("decision 25: special hours override the weekly schedule for that date", () => {
  // 2026-12-25 is a Friday, normally open 6pm-2am.
  const christmas = getScheduleOpenState(SCHEDULE, true, sgt("2026-12-25T19:00:00"));
  assert.equal(christmas.status, "closed");
  assert.match(christmas.detail ?? "", /special/);
  const extra: OpeningSchedule = {
    ...SCHEDULE,
    special: [{ date: "2026-10-20", ranges: [{ open: "08:00", close: "12:00" }] }],
  };
  assert.deepEqual(getScheduleOpenState(extra, true, sgt("2026-10-20T09:00:00")), {
    status: "open",
    detail: "Special hours · Closes 12pm",
  });
  assert.deepEqual(getUpcomingSpecialHours(SCHEDULE, sgt("2026-12-20T09:00:00")), [
    { label: "Fri 25 Dec", text: "Closed" },
  ]);
});

test("decision 25: the derived hours line reads back the same open state", () => {
  const text = formatScheduleText(SCHEDULE);
  assert.equal(
    text,
    "Mon 10am-2pm, 5pm-9pm; Tue-Thu Closed; Fri 6pm-2am; Sat 24 hours; Sun Closed",
  );
  for (const at of ["2026-10-19T12:00:00", "2026-10-19T15:00:00", "2026-10-24T01:00:00"]) {
    assert.equal(
      getVenueOpenState(text, true, sgt(at)).status,
      getScheduleOpenState(SCHEDULE, true, sgt(at)).status,
      at,
    );
  }
  assert.deepEqual(scheduleFromHoursText("Mon-Fri 10am-8pm").weekly.wed, [
    { open: "10:00", close: "20:00" },
  ]);
  assert.match(
    validateOpeningSchedule({ weekly: { mon: [{ open: "25:00", close: "02:00" }] } }) ?? "",
    /24-hour/,
  );
  assert.match(
    validateOpeningSchedule({
      weekly: {},
      special: [
        { date: "2026-12-25", ranges: [] },
        { date: "2026-12-25", ranges: [] },
      ],
    }) ?? "",
    /twice/,
  );
});

test("decision 25: the merchant badge says Open now or Closed when hours exist", () => {
  const outlet = {
    isLive: true,
    operatingHours: "",
    openingSchedule: SCHEDULE,
  } as unknown as MerchantOutlet;
  const status = getMerchantOutletStatus(outlet, sgt("2026-10-19T12:00:00"));
  assert.equal(getMerchantOutletStatusLabel(status), "Open now");
  assert.equal(
    getMerchantOutletStatusLabel(getMerchantOutletStatus(outlet, sgt("2026-10-20T12:00:00"))),
    "Closed",
  );
  const noHours = { ...outlet, openingSchedule: undefined };
  assert.equal(getMerchantOutletStatusLabel(getMerchantOutletStatus(noHours)), "Live on Hungry");
  assert.equal(
    getMerchantOutletStatusLabel(getMerchantOutletStatus({ ...outlet, isLive: false })),
    "Offline",
  );

  const migration = read(`${MIGRATIONS}/20261020130000_merchant_opening_schedule_address_pin.sql`);
  assert.match(migration, /add column if not exists opening_schedule jsonb/);
  assert.match(migration, /check \(app_private\.opening_schedule_is_valid\(opening_schedule\)\)/);
  assert.match(
    migration,
    /new\.opening_schedule is distinct from old\.opening_schedule then new\.opening_schedule/,
  );
  assert.match(migration, /or new\.opening_schedule is distinct from old\.opening_schedule\n/);
  assert.doesNotMatch(
    migration,
    /create or replace function public\.[^(]+\([^)]*\)\s*returns[^$]*security definer/,
  );
  assert.ok(existsSync("supabase/smoke/merchant_opening_schedule_address_pin.sql"));

  const editor = read("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  assert.match(editor, /<OpeningHoursEditor/);
  assert.match(editor, /operatingHours: formatScheduleText\(data\.openingSchedule\)/);
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");
  assert.match(stall, /discovery\.getVenueOpeningSchedule\(sideLoadVenueId\)/);
  assert.match(
    read("src/features/detail/stallOpenState.ts"),
    /getScheduleOpenState\(schedule, venue\.isOpen, now\)/,
  );
});

test("decision 27: unverified merchants can open the menu screens; live dishes stay locked", () => {
  for (const route of ["Menu", "DishEditor", "OCRDrafts"]) {
    assert.ok((UNVERIFIED_ALLOWED_SCREENS as readonly string[]).includes(route), route);
    assert.ok(!(VERIFIED_ONLY_SCREENS as readonly string[]).includes(route), route);
  }
  assert.equal(canManageMenu("unverified"), true);
  assert.equal(canManageMenu("none"), false);

  const migration = read(`${MIGRATIONS}/20261020130100_merchant_unverified_menu_drafts.sql`);
  assert.match(migration, /add column if not exists merchant_draft boolean not null default false/);
  assert.match(migration, /new\.merchant_draft := not v_verified;/);
  assert.match(migration, /before insert on public\.catalog_raw_dish_cards/);
  assert.match(migration, /before insert on public\.catalog_raw_dish_media/);
  assert.match(migration, /before insert on public\.catalog_raw_venue_cards/);
  assert.match(migration, /after insert or update of status on public\.merchant_verifications/);
  assert.ok(existsSync("supabase/smoke/merchant_unverified_menu_drafts.sql"));
});

test("decision 28: sold-out dishes come back on at Singapore midnight", () => {
  const migration = read(`${MIGRATIONS}/20261020130200_sold_out_nightly_reset.sql`);
  assert.match(migration, /'reset-sold-out-dishes',\n\s+'0 16 \* \* \*'/);
  assert.match(migration, /merchant_normalize_availability_flag\(f\.flag\) <> 'sold_out'/);
  assert.match(
    migration,
    /revoke all on function app_private\.reset_sold_out_dishes\(\) from public, anon, authenticated/,
  );
  assert.ok(existsSync("supabase/smoke/sold_out_nightly_reset.sql"));
  assert.match(read("src/app/screens/merchant/MerchantMenuScreen.tsx"), /Sold out until tomorrow/);
});

test("decision 29: postal codes resolve through OneMap only", async () => {
  assert.equal(
    buildOneMapSearchUrl("069184"),
    "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=069184&returnGeom=Y&getAddrDetails=Y&pageNum=1",
  );
  assert.deepEqual([...ALLOWED_FETCH_HOSTS], ["www.onemap.gov.sg"]);
  assert.throws(() => assertAllowedFetchUrl("https://evil.example/api"), /non-allowlisted/);
  assert.throws(() => assertAllowedFetchUrl("http://www.onemap.gov.sg/api"), /non-allowlisted/);

  const body = {
    found: 2,
    results: [
      { POSTAL: "069185", ADDRESS: "OTHER", LATITUDE: "1.28", LONGITUDE: "103.84" },
      {
        POSTAL: "069184",
        ADDRESS: "1 KADAYANALLUR STREET MAXWELL FOOD CENTRE SINGAPORE 069184",
        BUILDING: "MAXWELL FOOD CENTRE",
        LATITUDE: "1.28035",
        LONGITUDE: "103.84470",
      },
    ],
  };
  assert.deepEqual(parseOneMapPostalResponse("069184", body), {
    postalCode: "069184",
    address: "1 KADAYANALLUR STREET MAXWELL FOOD CENTRE SINGAPORE 069184",
    building: "MAXWELL FOOD CENTRE",
    coordinate: { latitude: 1.28035, longitude: 103.8447 },
  });
  assert.equal(parseOneMapPostalResponse("123456", body), null);

  const requested: string[] = [];
  const fakeFetch = (async (url: string) => {
    requested.push(url);
    return { ok: true, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  const found = await lookupPostalCode(" 069184 ", fakeFetch);
  assert.equal(found?.coordinate.latitude, 1.28035);
  assert.match(requested[0] ?? "", /^https:\/\/www\.onemap\.gov\.sg\//);
  await assert.rejects(lookupPostalCode("6918", fakeFetch), /6-digit/);

  assert.throws(() => validateMerchantProfileUpdates({ postalCode: "12345" }), /6 digits/);
  assert.throws(
    () => validateMerchantProfileUpdates({ coordinate: { latitude: 51.5, longitude: -0.1 } }),
    /Singapore/,
  );
  const editor = read("src/app/screens/merchant/BusinessProfileEditorScreen.tsx");
  assert.match(editor, /lookupPostalCode\(postalCode\)/);
  assert.match(editor, /<MapSurface/);
  assert.match(editor, /onMapPress=/);
});
