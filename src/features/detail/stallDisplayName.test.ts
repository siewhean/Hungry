import assert from "node:assert/strict";
import test from "node:test";

import { toDisplayName } from "./stallDisplayName";

test("R4-STALL-1: an ALL CAPS licence name is shown in title case", () => {
  assert.equal(
    toDisplayName("TIAN TIAN HAINANESE CHICKEN RICE"),
    "Tian Tian Hainanese Chicken Rice",
  );
  assert.equal(toDisplayName("EARLES SWENSEN"), "Earles Swensen");
});

test("R4-STALL-1: acronyms, numbers and small words are handled", () => {
  assert.equal(toDisplayName("NTUC FAIRPRICE"), "NTUC Fairprice");
  assert.equal(toDisplayName("KFC"), "KFC");
  assert.equal(toDisplayName("ABC BAK KUT TEH"), "ABC Bak Kut Teh");
  assert.equal(toDisplayName("BBQ AND GRILL HOUSE"), "BBQ and Grill House");
  assert.equal(toDisplayName("THE COFFEE BEAN"), "The Coffee Bean");
  assert.equal(toDisplayName("7-ELEVEN"), "7-Eleven");
  assert.equal(toDisplayName("S11 FOOD COURT"), "S11 Food Court");
  assert.equal(toDisplayName("AH HUAT BKT"), "Ah Huat BKT");
  assert.equal(toDisplayName("LIM & SONS PTE LTD"), "Lim & Sons Pte Ltd");
});

test("R4-STALL-1: apostrophes and Mc names", () => {
  assert.equal(toDisplayName("DAVID'S KITCHEN"), "David's Kitchen");
  assert.equal(toDisplayName("MCDONALD'S"), "McDonald's");
  assert.equal(toDisplayName("MCDONALD RESTAURANT"), "McDonald Restaurant");
  assert.equal(toDisplayName("D'ORIENT CAFE"), "D'Orient Cafe");
  assert.equal(toDisplayName("O'BRIEN PUB"), "O'Brien Pub");
});

test("R4-STALL-1: a name someone wrote with any lower case, and non-Latin names, are left alone", () => {
  assert.equal(toDisplayName("Tian Tian Chicken Rice"), "Tian Tian Chicken Rice");
  assert.equal(toDisplayName("ABC Kitchen"), "ABC Kitchen");
  assert.equal(toDisplayName("天天海南鸡饭"), "天天海南鸡饭");
  assert.equal(toDisplayName("#01-10"), "#01-10");
  assert.equal(toDisplayName(""), "");
});
