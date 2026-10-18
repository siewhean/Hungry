import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanBuildingName,
  deriveAreaFromStreet,
  formatVenueAddress,
  formatVenueAddressLine,
  formatVenueLocationLabel,
  toDisplayCase,
} from "./formatVenueAddress";

// Exact fields behind the Saizeriya stall-detail screenshot.
const saizeriya = {
  venueName: "SAIZERIYA ITALIAN RESTAURANT",
  unitNumber: "#02-514",
  buildingName: "Singapore 310190 | Unit: 02-514 | Postal Code: 310190",
  address: "190 LORONG 6 TOA PAYOH #02-514,Singapore 310190 | Unit: 02-514 | Postal code: 310190",
  postalCode: "310190",
};

test("formats the messy Saizeriya address into deduplicated lines", () => {
  const result = formatVenueAddress(saizeriya);
  assert.equal(result.building, undefined);
  assert.equal(result.street, "190 Lorong 6 Toa Payoh");
  assert.equal(result.unit, "#02-514");
  assert.equal(result.postalCode, "310190");
  assert.deepEqual(result.lines, ["190 Lorong 6 Toa Payoh", "Unit #02-514", "Singapore 310190"]);
});

test("parses the fully combined screenshot string with no structured fields", () => {
  const result = formatVenueAddress({
    venueName: "SAIZERIYA ITALIAN RESTAURANT",
    address:
      "SAIZERIYA ITALIAN RESTAURANT, #02-514, Singapore 310190 | Unit: 02-514 | Postal Code: 310190, 190 LORONG 6 TOA PAYOH #02-514,Singapore 310190 | Unit: 02-514 | Postal code: 310190, Singapore 310190",
  });
  assert.equal(result.unit, "#02-514");
  assert.equal(result.postalCode, "310190");
  assert.deepEqual(result.lines, ["Unit #02-514", "Singapore 310190"]);
  assert.ok(!result.lines.join(" ").includes("|"));
  assert.ok(!result.lines.join(" ").includes("SAIZERIYA"));
});

test("keeps a real building name as the first line", () => {
  const result = formatVenueAddress({
    venueName: "Ah Seng Fishball",
    unitNumber: "01-23",
    buildingName: "Kopitiam @ Toa Payoh",
    address: "480 Lorong 6 Toa Payoh",
    postalCode: "310480",
  });
  assert.deepEqual(result.lines, [
    "Kopitiam @ Toa Payoh",
    "480 Lorong 6 Toa Payoh",
    "Unit #01-23",
    "Singapore 310480",
  ]);
});

test("handles a missing unit", () => {
  const result = formatVenueAddress({
    address: "1 JALAN BESAR, Singapore 208787",
  });
  assert.equal(result.unit, undefined);
  assert.deepEqual(result.lines, ["1 Jalan Besar", "Singapore 208787"]);
});

test("handles a missing postal code", () => {
  const result = formatVenueAddress({
    unitNumber: "#B1-05",
    address: "68 Orchard Road #B1-05",
  });
  assert.equal(result.postalCode, undefined);
  assert.deepEqual(result.lines, ["68 Orchard Road", "Unit #B1-05"]);
});

test("leaves an already-clean, mixed-case address untouched", () => {
  const result = formatVenueAddress({
    unitNumber: "#01-12",
    address: "335 Smith Street",
    postalCode: "050335",
    buildingName: "Chinatown Complex",
  });
  assert.deepEqual(result.lines, [
    "Chinatown Complex",
    "335 Smith Street",
    "Unit #01-12",
    "Singapore 050335",
  ]);
});

test("keeps non-standard unit labels as provided", () => {
  assert.equal(formatVenueAddress({ unitNumber: "Stall 12" }).unit, "Stall 12");
  assert.equal(formatVenueAddress({ unitNumber: "Unit: 02-514" }).unit, "#02-514");
});

test("returns no lines for empty input", () => {
  assert.deepEqual(formatVenueAddress({}).lines, []);
});

test("cleanBuildingName rejects address fragments and the venue's own name", () => {
  assert.equal(cleanBuildingName(saizeriya.buildingName, saizeriya.venueName), undefined);
  assert.equal(
    cleanBuildingName("SAIZERIYA ITALIAN RESTAURANT", "Saizeriya Italian Restaurant"),
    undefined,
  );
  assert.equal(cleanBuildingName("190 Lorong 6 Toa Payoh"), undefined);
  assert.equal(cleanBuildingName("Singapore 310190"), undefined);
  assert.equal(cleanBuildingName("KOUFU @ TOA PAYOH HUB"), "Koufu @ Toa Payoh Hub");
  assert.equal(cleanBuildingName("Food Republic, VivoCity"), "Food Republic, VivoCity");
});

test("location label prefers building, then planning area, then derived area", () => {
  assert.equal(
    formatVenueLocationLabel({ ...saizeriya, buildingName: "Toa Payoh HDB Hub" }),
    "Toa Payoh HDB Hub",
  );
  assert.equal(formatVenueLocationLabel({ ...saizeriya, planningArea: "TOA PAYOH" }), "Toa Payoh");
  assert.equal(formatVenueLocationLabel(saizeriya), "Toa Payoh");
  assert.equal(formatVenueLocationLabel({ venueName: "X" }), undefined);
});

test("deriveAreaFromStreet strips block numbers and road words", () => {
  assert.equal(deriveAreaFromStreet("190 Lorong 6 Toa Payoh"), "Toa Payoh");
  assert.equal(deriveAreaFromStreet("123 ANG MO KIO AVENUE 3"), "Ang Mo Kio");
  assert.equal(deriveAreaFromStreet("Blk 85 Bedok North Street 4"), "Bedok North");
  assert.equal(deriveAreaFromStreet("1 Jalan Besar"), "Jalan Besar");
  assert.equal(deriveAreaFromStreet(""), undefined);
});

test("single-line address is clean and deduplicated", () => {
  assert.equal(
    formatVenueAddressLine(saizeriya),
    "Saizeriya Italian Restaurant, 190 Lorong 6 Toa Payoh, #02-514, Singapore 310190",
  );
});

test("toDisplayCase keeps unit codes and digits uppercase", () => {
  assert.equal(toDisplayCase("BLK 2A UPPER BOON KENG #01-02"), "Blk 2A Upper Boon Keng #01-02");
});

test("drops the building name when it is repeated inside the address (Rivervale Mall)", () => {
  const input = {
    venueName: "SAIZERIYA ITALIAN RESTAURANT",
    unitNumber: "#02-09",
    buildingName: "Rivervale Mall",
    address:
      "11 RIVERVALE CRESCENT #02-09,RIVERVALE MALL,Singapore 545082 | Unit: 02-09 | Postal code: 545082",
    postalCode: "545082",
  };
  assert.deepEqual(formatVenueAddress(input).lines, [
    "Rivervale Mall",
    "11 Rivervale Crescent",
    "Unit #02-09",
    "Singapore 545082",
  ]);
  assert.equal(formatVenueLocationLabel(input), "Rivervale Mall");
});
