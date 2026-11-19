import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMapsSearchUrl,
  buildStallMapsUrl,
  formatDistanceFromUser,
  formatFoodCentreLocation,
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

test("two spellings of one building read the same on every card", () => {
  const first = stallBuildingLabel({ buildingName: "Singapore 648310 Pioneer Mrt Stn" });
  const second = stallBuildingLabel({ buildingName: "Pioneer Mrt Station" });
  assert.equal(first, "Pioneer MRT Station");
  assert.equal(first, second);
  assert.equal(
    formatShortStallAddress({ unitNumber: "#01-02" }, { name: "Pioneer Mrt Stn" }),
    "#01-02, Pioneer MRT Station",
  );
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

test("formatFullStallAddress does not duplicate unit numbers or postal codes", () => {
  // Case 1: Address already contains unit, building name, and postal code
  const addr1 = formatFullStallAddress(
    { name: "Starbucks", unitNumber: "#01-06" },
    {
      name: "North Spine Plaza",
      address: "76 Nanyang Drive, #01-06 North Spine Plaza, Singapore 637331",
      postalCode: "637331",
    },
  );
  assert.equal(addr1, "Starbucks, 76 Nanyang Drive, #01-06 North Spine Plaza, Singapore 637331");

  // Case 2: Address does not have unit, injects cleanly without duplicate postal
  const addr2 = formatFullStallAddress(
    { name: "Sweet Talk", unitNumber: "#01-186" },
    {
      name: "960 Jurong West Street 92",
      address: "960 Jurong West Street 92, Singapore 640960",
      postalCode: "640960",
    },
  );
  assert.equal(addr2, "Sweet Talk, #01-186, 960 Jurong West Street 92, Singapore 640960");

  // Case 3: Missing address fallback
  const addr3 = formatFullStallAddress(
    { name: "E Veg Vegetarian", unitNumber: "#02-03" },
    {
      name: "North Spine Plaza",
      postalCode: "637331",
    },
  );
  assert.equal(addr3, "E Veg Vegetarian, #02-03, North Spine Plaza, Singapore 637331");
});

test("formatFoodCentreLocation returns clean building name and filters sub-unit clauses", () => {
  assert.equal(
    formatFoodCentreLocation({
      name: "North Spine Plaza",
      address: "76 Nanyang Drive, Singapore 637331",
    }),
    "North Spine Plaza",
  );
  // Invalid sub-unit clause falls back to street
  assert.equal(
    formatFoodCentreLocation({
      name: "(part Of) - Right Sub-unit",
      address: "960 Jurong West Street 92, #01-186, Singapore 640960",
    }),
    "960 Jurong West Street 92",
  );
  // Invalid campus block clause falls back to street
  assert.equal(
    formatFoodCentreLocation({
      name: "N2.1",
      address: "76 Nanyang Drive, Singapore 637331",
    }),
    "76 Nanyang Drive",
  );
  assert.equal(formatFoodCentreLocation(), "Food Centre");
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
    formatDistanceFromUser(user, { latitude: 1.32, longitude: 103.77 }) ?? "",
    /^\d+(\.\d+)?km away$/,
  );
});

test("the stall rating is review-weighted and the price band spans the listed prices", () => {
  const dishes = [
    { rating: 4, reviewCount: 10, price: 5 },
    { rating: 5, reviewCount: 10, price: 10 },
    { rating: 0, reviewCount: 0, price: 0 },
  ];
  assert.deepEqual(summarizeStallRating(dishes), { rating: 4.5, reviewCount: 20 });
  assert.equal(summarizeStallRating([]), undefined);
  assert.equal(formatStallPriceBand(dishes), "S$5.00–S$10.00");
  assert.equal(formatStallPriceBand([{ price: 4.5 }]), "S$4.50");
  assert.equal(formatStallPriceBand([]), undefined);
});
