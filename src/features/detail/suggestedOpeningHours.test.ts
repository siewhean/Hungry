import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSuggestedSchedule,
  describeSuggestedHours,
  emptySuggestedHoursDraft,
  suggestedHoursProblem,
} from "@/features/detail/suggestedOpeningHours";

test("daily hours fill all seven days", () => {
  const draft = { ...emptySuggestedHoursDraft(), daily: [{ open: "08:00", close: "20:00" }] };
  const schedule = buildSuggestedSchedule(draft);
  assert.equal(schedule.weekly.mon?.[0].open, "08:00");
  assert.equal(schedule.weekly.sun?.[0].close, "20:00");
  assert.match(describeSuggestedHours(schedule), /^Opening hours: Daily /);
});

test("weekday and weekend hours split Monday to Friday from the weekend", () => {
  const draft = {
    ...emptySuggestedHoursDraft(),
    mode: "weekdayWeekend" as const,
    weekday: [{ open: "07:00", close: "15:00" }],
    weekend: [],
  };
  const schedule = buildSuggestedSchedule(draft);
  assert.equal(schedule.weekly.fri?.[0].open, "07:00");
  assert.deepEqual(schedule.weekly.sat, []);
  assert.deepEqual(schedule.weekly.sun, []);
  assert.match(describeSuggestedHours(schedule), /Mon-Fri .*; Sat-Sun Closed/);
  assert.equal(suggestedHoursProblem(draft), undefined);
});

test("day by day hours keep special dates in the note", () => {
  const draft = {
    ...emptySuggestedHoursDraft(),
    mode: "custom" as const,
    custom: {
      weekly: { mon: [{ open: "10:00", close: "18:00" }] },
      special: [{ date: "2026-12-25", ranges: [] }],
    },
  };
  const note = describeSuggestedHours(buildSuggestedSchedule(draft));
  assert.match(note, /Mon 10am-6pm/);
  assert.match(note, /2026-12-25 Closed/);
  assert.equal(suggestedHoursProblem(draft), undefined);
});

test("hours with nothing set, a bad time or too many dates cannot be sent", () => {
  const empty = { ...emptySuggestedHoursDraft(), mode: "custom" as const };
  assert.match(suggestedHoursProblem(empty) ?? "", /Switch on the days/);
  const noTimes = { ...emptySuggestedHoursDraft(), daily: [] };
  assert.match(suggestedHoursProblem(noTimes) ?? "", /Add the opening times/);
  const badTime = { ...emptySuggestedHoursDraft(), daily: [{ open: "9am", close: "21:00" }] };
  assert.match(suggestedHoursProblem(badTime) ?? "", /24-hour times/);
  const special = Array.from({ length: 40 }, (_, i) => ({
    date: `2027-01-${String((i % 28) + 1).padStart(2, "0")}`,
    ranges: [],
  })).filter((day, index, all) => all.findIndex((d) => d.date === day.date) === index);
  const crowded = {
    ...emptySuggestedHoursDraft(),
    mode: "custom" as const,
    custom: { weekly: { mon: [{ open: "10:00", close: "18:00" }] }, special },
  };
  assert.match(suggestedHoursProblem(crowded) ?? "", /too much to send/);
});
