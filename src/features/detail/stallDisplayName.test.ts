import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanLocationQualifier,
  cleanStallName,
  isPlaceholderStall,
  toDisplayName,
} from "./stallDisplayName";

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

test("STALL-CHAIN-CLEAN: location qualifiers beside chain stall names exclude address names and unit numbers", () => {
  // User's exact NTU North Spine Starbucks example
  assert.equal(
    toDisplayName("Starbucks (76 Nanyang Drive 01-06 NTU North Spine)"),
    "Starbucks (NTU North Spine)",
  );
  assert.equal(
    toDisplayName("STARBUCKS (76 NANYANG DRIVE 01-06 NTU NORTH SPINE)"),
    "Starbucks (NTU North Spine)",
  );
  assert.equal(
    toDisplayName("Starbucks 2 Bukit Batok West Ave 7 01-01/02/03 HomeTeamNS"),
    "Starbucks (HomeTeamNS)",
  );
  assert.equal(
    toDisplayName("Starbucks 9 Raffles Boulevard 01-K7/K11/K12 K13 Millenia Walk"),
    "Starbucks (Millenia Walk)",
  );
  assert.equal(toDisplayName("Starbucks (Harbourfront Centre)"), "Starbucks (Harbourfront Centre)");
  assert.equal(toDisplayName("Starbucks (NTU North Spine)"), "Starbucks (NTU North Spine)");
  assert.equal(toDisplayName("Starbucks 37 Smith St"), "Starbucks (Smith Street)");
  assert.equal(toDisplayName("Starbucks 461 Clementi Rd"), "Starbucks (Clementi Road)");
});

test("STALL-CHAIN-CLEAN: chain stalls and hawkers across the catalog have address/unit noise stripped", () => {
  assert.equal(toDisplayName("McDonald's Blk 846 Yishun Ring Rd"), "McDonald's (Yishun Ring Road)");
  assert.equal(
    toDisplayName("Kimly Zi Char 金味海鲜 (Blk 221 Boon Lay Place)"),
    "Kimly Zi Char 金味海鲜 (Boon Lay Place)",
  );
  assert.equal(
    toDisplayName(
      "Hua Zai Hong Kong Style Roasted Delight Hua Zai Eating House (Blk 153A Serangoon North)",
    ),
    "Hua Zai Hong Kong Style Roasted Delight Hua Zai Eating House (Serangoon North)",
  );
  assert.equal(
    toDisplayName("Lets serve the skewers 上尚签串 (100 Jln Sultan)"),
    "Lets serve the skewers 上尚签串 (Jalan Sultan)",
  );
  assert.equal(toDisplayName("Taste Of India (77 Rangoon Rd)"), "Taste Of India (Rangoon Road)");
  assert.equal(
    toDisplayName("Alankar Restaurant (4 Norris Road)"),
    "Alankar Restaurant (Norris Road)",
  );
  assert.equal(
    toDisplayName("Chops & Sear - 46 Telok Blangah Drive"),
    "Chops & Sear (Telok Blangah Drive)",
  );
  // Bare unit numbers inside parentheses are stripped entirely
  assert.equal(toDisplayName("Yuan Yang Spinach Soup (#01-12)"), "Yuan Yang Spinach Soup");
  assert.equal(toDisplayName("Bugis Teochew Beef Noodle (#01-72)"), "Bugis Teochew Beef Noodle");
  // SFA licensed stall placeholders are detected and removed entirely
  assert.equal(isPlaceholderStall("SFA Licensed Stall #01-08 (GB20108001)"), true);
  assert.equal(isPlaceholderStall("SFA Licensed Food Establishment (E82092C020)"), true);
  assert.equal(toDisplayName("SFA Licensed Stall #01-08 (GB20108001)"), "");
  assert.equal(toDisplayName("San Shu Gong (part Of)"), "San Shu Gong");
  // Any general stall or chain followed by an address without parentheses
  assert.equal(
    toDisplayName("Song Fa Bak Kut Teh 11 New Bridge Rd"),
    "Song Fa Bak Kut Teh (New Bridge Road)",
  );
  assert.equal(
    toDisplayName("Peperoni Pizzeria 95 Frankel Ave"),
    "Peperoni Pizzeria (Frankel Avenue)",
  );
  assert.equal(
    toDisplayName("The Penyet Co Blk 678A Woodlands Ave 6"),
    "The Penyet Co (Woodlands Avenue 6)",
  );
  assert.equal(toDisplayName("The Summer Acai 9 Sin Ming Rd"), "The Summer Acai (Sin Ming Road)");
  assert.equal(toDisplayName("Panda Yeah 11 Canberra Rd"), "Panda Yeah (Canberra Road)");
  // St George preserved as Saint, not Street
  assert.equal(
    toDisplayName("The Daily Fiesta (St George's Road)"),
    "The Daily Fiesta (St George's Road)",
  );
  // Block town numbers stripped
  assert.equal(toDisplayName("Tenderbest (514A Bishan)"), "Tenderbest (Bishan)");
  assert.equal(
    toDisplayName("Yishun 925 Chicken Rice (722 Ang Mo Kio)"),
    "Yishun 925 Chicken Rice (Ang Mo Kio)",
  );
  // Unit number stripped from landmark
  assert.equal(
    toDisplayName("TOTOFISH (Hong Lim Market & Food Centre #02-52)"),
    "TOTOFISH (Hong Lim Market & Food Centre)",
  );
});
