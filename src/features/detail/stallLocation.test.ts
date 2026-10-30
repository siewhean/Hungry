import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMapsSearchUrl,
  buildStallMapsUrl,
  formatDistanceFromUser,
  formatFullStallAddress,
  formatShortStallAddress,
  formatStallPriceBand,
  getStallPin,
  stallBuildingLabel,
  summarizeStallRating,
} from "./stallLocation";

const queryOf = (url: string) => decodeURIComponent(new URL(url).searchParams.get("query") ?? "");

test("formatShortStallAddress shows unit and building, never the street or postcode", () => {
  assert.equal(
    formatShortStallAddress(
      { unitNumber: "#01-23" },
      { name: "NUS UTown", address: "2 College Avenue West", postalCode: "138607" },
    ),
    "#01-23, NUS UTown",
  );
});

test("formatShortStallAddress falls back to the street (still no postcode) without a building", () => {
  assert.equal(
    formatShortStallAddress(
      { unitNumber: " #02-01 " },
      { address: "12 Smith Street", postalCode: "058925" },
    ),
    "#02-01, 12 Smith Street",
  );
  assert.equal(
    formatShortStallAddress({ unitNumber: "" }, { name: "Maxwell Food Centre" }),
    "Maxwell Food Centre",
  );
  assert.equal(formatShortStallAddress({ unitNumber: "" }), "");
});

test("stallBuildingLabel names the building and only falls back to the planning area", () => {
  assert.equal(
    stallBuildingLabel({ buildingName: "NUS UTown", planningArea: "Queenstown" }),
    "NUS UTown",
  );
  assert.equal(
    stallBuildingLabel({ buildingName: " ", planningArea: "Queenstown" }, { name: "NUS E3" }),
    "NUS E3",
  );
  assert.equal(stallBuildingLabel({ planningArea: "Queenstown" }), "Queenstown");
  assert.equal(stallBuildingLabel({}), undefined);
});

test("the Maps link searches by stall, building and postcode, not by the stall's pin", () => {
  const url = buildStallMapsUrl(
    { name: "Ah Seng Noodles", buildingName: "NUS UTown", postalCode: "138607" },
    { latitude: 1.3, longitude: 103.77 },
  );
  assert.equal(queryOf(url), "Ah Seng Noodles, NUS UTown, Singapore 138607");
  assert.doesNotMatch(queryOf(url), /^1\.3,/);
});

test("the full address keeps every part for Google Maps; the short one is what the page shows", () => {
  const venue = { name: "Ah Seng Noodles", unitNumber: "#01-23" };
  const building = { name: "NUS UTown", address: "2 College Avenue West", postalCode: "138607" };
  assert.equal(
    formatFullStallAddress(venue, building),
    "Ah Seng Noodles, #01-23, NUS UTown, 2 College Avenue West, Singapore 138607",
  );
  assert.equal(
    queryOf(buildMapsSearchUrl("Ah Seng Noodles, NUS UTown")),
    "Ah Seng Noodles, NUS UTown",
  );
});

test("a stall pin only counts when it sits apart from its building", () => {
  const building = { latitude: 1.3, longitude: 103.77 };
  assert.equal(getStallPin({}, building), undefined);
  assert.equal(getStallPin({ latitude: 1.3, longitude: 103.77 }, building), undefined);
  assert.deepEqual(getStallPin({ latitude: 1.31, longitude: 103.78 }, building), {
    latitude: 1.31,
    longitude: 103.78,
  });
  assert.deepEqual(getStallPin({ latitude: 1.31, longitude: 103.78 }), {
    latitude: 1.31,
    longitude: 103.78,
  });
});

test("distance reads from the user to the building, and stays blank without either point", () => {
  const user = { latitude: 1.3, longitude: 103.77 };
  assert.equal(formatDistanceFromUser(user, undefined), undefined);
  assert.equal(formatDistanceFromUser(user, { latitude: 0, longitude: 0 }), undefined);
  assert.equal(formatDistanceFromUser(undefined, { latitude: 1.31, longitude: 103.78 }), undefined);
  assert.match(
    formatDistanceFromUser(user, { latitude: 1.3005, longitude: 103.77 }) ?? "",
    /^\d+m away$/,
  );
  assert.match(
    formatDistanceFromUser(user, { latitude: 1.35, longitude: 103.77 }) ?? "",
    /km away$/,
  );
});

test("the stall rating is review-weighted and the price band spans the listed prices", () => {
  assert.equal(summarizeStallRating([{ rating: 4.5, reviewCount: 0 }]), undefined);
  assert.deepEqual(
    summarizeStallRating([
      { rating: 5, reviewCount: 1 },
      { rating: 4, reviewCount: 3 },
      { rating: 0, reviewCount: 9 },
    ]),
    { rating: 4.25, reviewCount: 4 },
  );
  assert.equal(formatStallPriceBand([{ price: 0 }]), undefined);
  assert.equal(formatStallPriceBand([{ price: 4.5 }, { price: 4.5 }]), "S$4.50");
  assert.equal(formatStallPriceBand([{ price: 8 }, { price: 4.5 }]), "S$4.50–S$8.00");
});
