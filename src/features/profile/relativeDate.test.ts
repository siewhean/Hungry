import assert from "node:assert/strict";
import test from "node:test";

import { formatMemberSince, formatRelativeDate } from "./relativeDate";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test("a review a few seconds old is 'just now'", () => {
  assert.equal(formatRelativeDate(ago(10_000), NOW), "just now");
});

test("minutes, hours, days and weeks are singular at one and plural after", () => {
  assert.equal(formatRelativeDate(ago(MINUTE), NOW), "1 minute ago");
  assert.equal(formatRelativeDate(ago(45 * MINUTE), NOW), "45 minutes ago");
  assert.equal(formatRelativeDate(ago(HOUR), NOW), "1 hour ago");
  assert.equal(formatRelativeDate(ago(5 * HOUR), NOW), "5 hours ago");
  assert.equal(formatRelativeDate(ago(DAY), NOW), "1 day ago");
  assert.equal(formatRelativeDate(ago(6 * DAY), NOW), "6 days ago");
  assert.equal(formatRelativeDate(ago(7 * DAY), NOW), "1 week ago");
  assert.equal(formatRelativeDate(ago(21 * DAY), NOW), "3 weeks ago");
});

test("older than a month it is a short date, with the year only when it is not this year", () => {
  assert.match(formatRelativeDate(ago(60 * DAY), NOW), /^\d{1,2} \w+$/);
  assert.match(formatRelativeDate("2025-03-04T00:00:00.000Z", NOW), /2025/);
});

test("an unreadable date is empty, so the card shows no date at all", () => {
  assert.equal(formatRelativeDate("", NOW), "");
  assert.equal(formatRelativeDate("not a date", NOW), "");
  assert.equal(formatMemberSince(""), "");
});

test("member since is month and year", () => {
  assert.match(formatMemberSince("2026-10-05T00:00:00.000Z"), /Oct(ober)? 2026/);
});
