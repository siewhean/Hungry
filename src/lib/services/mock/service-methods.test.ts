import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";

test("discovery.getBuildingDetail returns enriched building metadata", async () => {
  const detail = await hungryService.discovery.getBuildingDetail("building-maxwell");

  assert.ok(detail);
  assert.equal(detail?.id, "building-maxwell");
  assert.ok(Boolean(detail?.address));
  assert.ok((detail?.totalStalls ?? 0) > 0);
});

test("discovery.getFloorPlan returns a floor plan with polygon geometry", async () => {
  const floorPlan = await hungryService.discovery.getFloorPlan("building-maxwell", "L1");

  assert.ok(floorPlan);
  assert.equal(floorPlan?.buildingId, "building-maxwell");
  assert.equal(floorPlan?.floor, "L1");
  assert.ok((floorPlan?.stalls.length ?? 0) > 0);
  assert.ok((floorPlan?.stalls[0]?.polygon.length ?? 0) >= 3);
});

test("discovery.searchDishes maps repository results into scored search contracts", async () => {
  const results = await hungryService.discovery.searchDishes(
    {
      query: "",
      categories: [],
      dietaryFlags: ["vegetarian"],
      tasteValues: NEUTRAL_TASTE_VECTOR,
      radius: 3000,
    },
    NEUTRAL_TASTE_VECTOR,
  );

  assert.ok(results.length > 0);
  assert.ok(results.every((result) => result.score >= 0 && result.score <= 1));
  assert.ok(results.every((result) => result.dish.dietaryFlags.includes("vegetarian")));
});

test("reviews.submitReview persists reviewed dish id in profile state", async () => {
  await hungryService.auth.signIn("reviewer@hungry.sg", "password");
  try {
    const beforeProfile = await hungryService.profile.getProfile();
    const dishToReview = dishes.find((dish) => !beforeProfile.reviewedDishIds.includes(dish.id));
    assert.ok(dishToReview, "Expected at least one reviewable fixture dish");

    await hungryService.reviews.submitReview({
      dishId: dishToReview.id,
      venueId: dishToReview.venueId,
      rating: 5,
      text: "Great dish.",
      tags: ["Fragrant"],
      photos: [],
    });

    const afterProfile = await hungryService.profile.getProfile();
    assert.ok(afterProfile.reviewedDishIds.includes(dishToReview.id));
  } finally {
    await hungryService.auth.signOut();
  }
});

test("reviews.listRecentReviews pages newest-first reviews across dishes", async () => {
  const firstPage = await hungryService.reviews.listRecentReviews({ limit: 2 });
  assert.ok(firstPage.length > 0 && firstPage.length <= 2);
  const times = firstPage.map((entry) => new Date(entry.review.createdAt).getTime());
  assert.deepEqual(
    times,
    [...times].sort((a, b) => b - a),
  );
  assert.ok(firstPage.every((entry) => entry.dishId && entry.dishName && entry.venueId));

  const oldest = firstPage[firstPage.length - 1]?.review.createdAt;
  assert.ok(oldest);
  const nextPage = await hungryService.reviews.listRecentReviews({ limit: 2, before: oldest });
  assert.ok(
    nextPage.every(
      (entry) => new Date(entry.review.createdAt).getTime() < new Date(oldest).getTime(),
    ),
  );
});

test("discovery.decideForMe respects profile dietary preferences", async () => {
  await hungryService.auth.signIn("dietary@hungry.sg", "password");
  const originalPreferences = (await hungryService.profile.getProfile()).dietaryPreferences;
  try {
    await hungryService.profile.updateDietaryPreferences(["halal"]);

    const recommendation = await hungryService.discovery.decideForMe(NEUTRAL_TASTE_VECTOR);
    assert.ok(recommendation, "Expected a recommendation for halal profile");
    assert.ok(recommendation?.dietaryFlags.includes("halal"));
  } finally {
    await hungryService.profile.updateDietaryPreferences(originalPreferences);
    await hungryService.auth.signOut();
  }
});

test("recommendations.getSlate returns shared recommendation shape with hard dietary filters", async () => {
  const slate = await hungryService.recommendations.getSlate({
    surface: "discover",
    tasteProfile: NEUTRAL_TASTE_VECTOR,
    dietaryFlags: ["vegetarian"],
    limit: 5,
  });

  assert.equal(slate.surface, "discover");
  assert.ok(slate.generatedAt.length > 0);
  assert.ok(slate.items.length > 0);
  assert.ok(slate.items.every((item) => item.dish.dietaryFlags.includes("vegetarian")));
  assert.ok(slate.items.every((item) => item.matchScore >= 0 && item.matchScore <= 1));
});

test("recommendations.recordExplicitFeedback applies food-specific click signals", async () => {
  const dish = dishes[0];
  assert.ok(dish, "Expected fixture dish for recommendation feedback");

  const beforeProfile = await hungryService.profile.getProfile();
  const result = await hungryService.recommendations.recordExplicitFeedback({
    feedbackType: "food_button_click",
    surface: "home",
    dishId: dish.id,
    buttonId: "view_stall",
  });

  assert.equal(result.applied, true);
  assert.notDeepEqual(result.tasteVector, beforeProfile.tasteVector);
});

test("checklist mock service persists items, tried state, and reorder", async () => {
  const checklist = await hungryService.checklist.createChecklist("Codex checklist");
  const firstItem = await hungryService.checklist.addChecklistItem({
    checklistId: checklist.id,
    itemType: "custom",
    customText: "Try breakfast bee hoon",
  });
  const secondItem = await hungryService.checklist.addChecklistItem({
    checklistId: checklist.id,
    itemType: "dish",
    dishId: dishes[0].id,
  });

  assert.ok(
    (await hungryService.checklist.getChecklists()).some((entry) => entry.id === checklist.id),
  );
  assert.deepEqual(
    (await hungryService.checklist.getChecklistItems(checklist.id)).map((item) => item.id),
    [firstItem.id, secondItem.id],
  );

  await hungryService.checklist.markChecklistItemTried(secondItem.id);
  assert.ok(
    (await hungryService.checklist.getChecklistItems(checklist.id)).find(
      (item) => item.id === secondItem.id,
    )?.triedAt,
  );

  await hungryService.checklist.reorderChecklistItems(checklist.id, [secondItem.id, firstItem.id]);
  assert.deepEqual(
    (await hungryService.checklist.getChecklistItems(checklist.id)).map((item) => item.id),
    [secondItem.id, firstItem.id],
  );

  await assert.rejects(
    hungryService.checklist.addChecklistItem({
      checklistId: checklist.id,
      itemType: "dish",
      dishId: dishes[0].id,
    }),
    /already in the checklist/,
  );
  await assert.rejects(
    hungryService.checklist.reorderChecklistItems(checklist.id, [firstItem.id]),
    /requires every current item exactly once/,
  );
});

test("portfolio mock service persists publish, item, follow, flag, and search state", async () => {
  const portfolio = await hungryService.portfolio.createPortfolio({
    name: "Codex hawker picks",
    description: "Reliable lunch ideas",
    type: "recommendation",
    visibility: "public",
  });
  const item = await hungryService.portfolio.addPortfolioItem({
    portfolioId: portfolio.id,
    itemType: "dish",
    dishId: dishes[0].id,
    score: 9,
    publicNotes: "Worth queueing for",
  });

  await hungryService.portfolio.publishPortfolio(portfolio.id);
  const published = await hungryService.portfolio.getPortfolio(portfolio.id);
  assert.ok(published.publishedAt);
  assert.equal((await hungryService.portfolio.getPortfolioItems(portfolio.id))[0]?.id, item.id);

  await assert.rejects(
    hungryService.portfolio.addPortfolioItem({
      portfolioId: portfolio.id,
      itemType: "dish",
      dishId: dishes[0].id,
    }),
    /already in the portfolio/,
  );

  await assert.rejects(
    hungryService.portfolio.addPortfolioItem({
      portfolioId: portfolio.id,
      itemType: "dish",
      dishId: dishes[1].id,
      score: 11,
    }),
    /score must be between 1 and 10/,
  );
  await assert.rejects(
    hungryService.portfolio.reorderPortfolioItems(portfolio.id, []),
    /requires every current item exactly once/,
  );

  await hungryService.portfolio.flagPortfolio(portfolio.id, "misleading", "test report");
  assert.ok(
    (await hungryService.portfolio.getPortfolioFlags({ status: "pending" })).some(
      (flag) => flag.portfolioId === portfolio.id && flag.reason === "misleading",
    ),
  );

  const results = await hungryService.portfolio.searchPortfolios("hawker");
  assert.ok(results.some((entry) => entry.id === portfolio.id));
});

test("portfolio mock service rejects stale optimistic mutation versions", async () => {
  const portfolio = await hungryService.portfolio.createPortfolio({
    name: "Codex conflict picks",
    description: "Original version",
    type: "collection",
    visibility: "private",
  });
  const staleVersion = portfolio.updatedAt;

  await new Promise((resolve) => setTimeout(resolve, 2));
  await hungryService.portfolio.updatePortfolio(portfolio.id, {
    name: "Remote edit",
    type: portfolio.type,
    visibility: portfolio.visibility,
  });

  await assert.rejects(
    hungryService.portfolio.addPortfolioItem(
      {
        portfolioId: portfolio.id,
        itemType: "dish",
        dishId: dishes[2].id,
      },
      { portfolioId: portfolio.id, expectedUpdatedAt: staleVersion },
    ),
    /changed elsewhere/,
  );

  const latest = await hungryService.portfolio.getPortfolio(portfolio.id);
  await hungryService.portfolio.addPortfolioItem(
    {
      portfolioId: portfolio.id,
      itemType: "dish",
      dishId: dishes[2].id,
    },
    { portfolioId: portfolio.id, expectedUpdatedAt: latest.updatedAt },
  );
  assert.equal((await hungryService.portfolio.getPortfolioItems(portfolio.id)).length, 1);
});

test("portfolio mock service records passport contribution progress", async () => {
  const beforeEvents = await hungryService.passport.getPassportProgressEvents();
  const portfolio = await hungryService.portfolio.createPortfolio({
    name: "Codex trail passport",
    description: "A public trail contribution",
    type: "trail",
    visibility: "private",
  });
  const item = await hungryService.portfolio.addPortfolioItem({
    portfolioId: portfolio.id,
    itemType: "dish",
    dishId: dishes[1].id,
    score: 8,
  });

  await hungryService.portfolio.publishPortfolio(portfolio.id);

  const stamps = await hungryService.passport.getPassportStamps();
  const events = await hungryService.passport.getPassportProgressEvents();
  const newEvents = events.filter(
    (event) => !beforeEvents.some((beforeEvent) => beforeEvent.id === event.id),
  );

  assert.ok(stamps.some((stamp) => stamp.portfolioItemsAdded >= 1));
  assert.ok(stamps.some((stamp) => stamp.publicPortfoliosPublished >= 1));
  assert.ok(stamps.some((stamp) => stamp.trailsCompleted >= 1));
  assert.ok(
    newEvents.some(
      (event) => event.eventType === "portfolio_item_added" && event.referenceId === item.id,
    ),
  );
  assert.ok(
    newEvents.some(
      (event) =>
        event.eventType === "public_portfolio_published" && event.referenceId === portfolio.id,
    ),
  );
  assert.ok(
    newEvents.some(
      (event) => event.eventType === "trail_completed" && event.referenceId === portfolio.id,
    ),
  );
});

test("ai.processImplicitFeedback is no-op while explicit learning stabilizes", async () => {
  const dish = dishes[0];
  assert.ok(dish, "Expected fixture dish for implicit feedback no-op test");

  const beforeProfile = await hungryService.profile.getProfile();
  const result = await hungryService.ai.processImplicitFeedback([
    {
      type: "dwell_time",
      dishId: dish.id,
      timestamp: Date.now(),
    },
  ]);
  const afterProfile = await hungryService.profile.getProfile();

  assert.deepEqual(result, beforeProfile.tasteVector);
  assert.deepEqual(afterProfile.tasteVector, beforeProfile.tasteVector);
});

test("auth.signInWithEmailCode then verifyEmailCode signs in with the typed address and name", async () => {
  await hungryService.auth.signInWithEmailCode("Mei@Example.sg", { displayName: " Mei " });
  const session = await hungryService.auth.verifyEmailCode("Mei@Example.sg", "12345678", "email");
  assert.equal(session?.profile.displayName, "Mei");
  assert.equal(session?.profile.email, "Mei@Example.sg");
  assert.equal((await hungryService.auth.getCurrentSession())?.profile.displayName, "Mei");
  await hungryService.auth.signOut();

  // A second sign-in without a name does not inherit the last one.
  await hungryService.auth.signInWithEmailCode("other@example.sg");
  const other = await hungryService.auth.verifyEmailCode("other@example.sg", "12345678", "email");
  assert.notEqual(other?.profile.displayName, "Mei");
  await hungryService.auth.signOut();
});

test("auth.requestAccountDeletion clears mock session", async () => {
  await hungryService.auth.signIn("delete-me@hungry.sg", "password");
  await hungryService.auth.requestAccountDeletion({
    userId: "mock-user",
    reason: "test",
  });

  const session = await hungryService.auth.getCurrentSession();
  assert.equal(session, null);
});

test("account deletion stays cancellable during the grace period", async () => {
  await hungryService.auth.signIn("delete-me@hungry.sg", "password");
  await hungryService.auth.requestAccountDeletion({ reason: "test" });
  assert.equal(await hungryService.auth.getPendingAccountDeletion(), null);

  await hungryService.auth.signIn("delete-me@hungry.sg", "password");
  const pending = await hungryService.auth.getPendingAccountDeletion();
  assert.ok(pending);
  const daysAway = (new Date(pending.scheduledFor).getTime() - Date.now()) / 86_400_000;
  assert.ok(daysAway > 29.9 && daysAway <= 30);

  assert.equal(await hungryService.auth.cancelAccountDeletion(), true);
  assert.equal(await hungryService.auth.getPendingAccountDeletion(), null);
  assert.equal(await hungryService.auth.cancelAccountDeletion(), false);
  await hungryService.auth.signOut();
});

test("data export collects the signed-in user's profile and activity", async () => {
  const { buildMyDataExport } = await import("@/features/profile/exportMyData");
  await hungryService.auth.signIn("export-me@hungry.sg", "password");
  try {
    const exported = await buildMyDataExport(hungryService);
    assert.equal(exported.exportVersion, 2);
    assert.match(exported.otherDataRequests, /usehungrysingapore@gmail\.com/);
    assert.ok((exported.data.profile as { id?: string }).id);
    for (const category of ["reviews", "posts", "favouriteDishIds", "savedPosts", "followers"]) {
      assert.ok(exported.categories.includes(category), category);
      assert.ok(Array.isArray(exported.data[category]), category);
    }
    assert.deepEqual(exported.categories, Object.keys(exported.data));
    assert.doesNotThrow(() => JSON.stringify(exported));
  } finally {
    await hungryService.auth.signOut();
  }
});

test("profile.updateProfile persists mock profile visibility", async () => {
  const beforeProfile = await hungryService.profile.getProfile();

  try {
    const privateProfile = await hungryService.profile.updateProfile({
      profileVisibility: "private",
    });
    assert.equal(privateProfile.profileVisibility, "private");
    assert.equal((await hungryService.profile.getProfile()).profileVisibility, "private");

    const publicProfile = await hungryService.profile.updateProfile({
      profileVisibility: "public",
    });
    assert.equal(publicProfile.profileVisibility, "public");
    assert.equal((await hungryService.profile.getProfile()).profileVisibility, "public");
  } finally {
    await hungryService.profile.updateProfile({
      profileVisibility: beforeProfile.profileVisibility,
    });
  }
});

test("merchant menu methods persist CRUD and status toggles in mock state", async () => {
  const outletId = "outlet-wonton-mee";
  const userVisibleVenueId = `mock-venue-${outletId}`;
  const beforeMenu = await hungryService.merchant.getMenu(outletId);
  const seededDish = beforeMenu[0];
  assert.ok(seededDish, "Expected seeded merchant menu dish");
  assert.notEqual(seededDish.id, "dish-chicken-rice");

  const addedDish = await hungryService.merchant.addDish(outletId, {
    id: "dish-chicken-rice",
    name: "Codex Test Noodles",
    price: 7.5,
    priceRange: "S$7.50",
    description: "Service test dish.",
    imageUrl: "https://example.com/codex-test-noodles.jpg",
    gallery: ["https://example.com/codex-test-noodles.jpg"],
    tasteTags: ["egg noodles", "dark soy sauce"],
    dietaryFlags: ["pork_free", "soy_free"],
    availabilityFlags: [],
  });

  const afterAdd = await hungryService.merchant.getMenu(outletId);
  assert.equal(afterAdd.length, beforeMenu.length + 1);
  assert.ok(afterAdd.some((dish) => dish.id === addedDish.id));
  assert.notEqual(addedDish.id, "dish-chicken-rice");
  const userVisibleVenue = await hungryService.discovery.getVenue(userVisibleVenueId);
  assert.equal(userVisibleVenue?.name, "Uncle Tan's Wonton Mee");
  assert.equal((await hungryService.discovery.getDish(addedDish.id))?.venueId, userVisibleVenueId);
  assert.ok(
    (await hungryService.discovery.listDishesByVenue(userVisibleVenueId)).some(
      (dish) => dish.id === addedDish.id,
    ),
  );

  const editedDish = await hungryService.merchant.editDish(outletId, addedDish.id, {
    price: 8,
    priceRange: "S$8.00",
  });
  assert.equal(editedDish.price, 8);
  assert.equal(editedDish.priceRange, "S$8.00");
  assert.equal((await hungryService.discovery.getDish(addedDish.id))?.price, 8);
  assert.equal(addedDish.imageUrl, "https://example.com/codex-test-noodles.jpg");
  assert.deepEqual(addedDish.gallery, ["https://example.com/codex-test-noodles.jpg"]);
  assert.deepEqual(addedDish.tasteTags, ["egg noodles", "dark soy sauce"]);
  assert.deepEqual(addedDish.dietaryFlags, ["pork_free", "soy_free"]);

  assert.equal(await hungryService.merchant.toggleSoldOut(outletId, addedDish.id), true);
  assert.ok(
    (await hungryService.merchant.getMenu(outletId))
      .find((dish) => dish.id === addedDish.id)
      ?.availabilityFlags.includes("Sold out"),
  );
  assert.ok(
    (await hungryService.discovery.getDish(addedDish.id))?.availabilityFlags.includes("Sold out"),
  );

  assert.equal(await hungryService.merchant.toggleFeatured(outletId, addedDish.id), true);
  assert.ok(
    (await hungryService.merchant.getMenu(outletId))
      .find((dish) => dish.id === addedDish.id)
      ?.availabilityFlags.includes("Featured"),
  );
  assert.ok(
    (await hungryService.discovery.getDish(addedDish.id))?.availabilityFlags.includes("Featured"),
  );

  await hungryService.merchant.deleteDish(outletId, addedDish.id);
  const afterDelete = await hungryService.merchant.getMenu(outletId);
  assert.equal(afterDelete.length, beforeMenu.length);
  assert.ok(!afterDelete.some((dish) => dish.id === addedDish.id));
  assert.equal(await hungryService.discovery.getDish(addedDish.id), undefined);
  assert.ok(
    !(await hungryService.discovery.listDishesByVenue(userVisibleVenueId)).some(
      (dish) => dish.id === addedDish.id,
    ),
  );
});

test("merchant seeded menu edits do not overwrite original mock catalog fixtures", async () => {
  const outletId = "outlet-wonton-mee";
  const seededDish = (await hungryService.merchant.getMenu(outletId))[0];
  assert.ok(seededDish, "Expected seeded merchant menu dish");

  await hungryService.merchant.toggleFeatured(outletId, seededDish.id);

  const originalDish = await hungryService.discovery.getDish("dish-chicken-rice");
  const merchantVisibleDish = await hungryService.discovery.getDish(seededDish.id);
  assert.equal(originalDish?.venueId, "venue-tian-tian");
  assert.equal(originalDish?.venueName, "Tian Tian Chicken Rice");
  assert.equal(merchantVisibleDish?.venueId, `mock-venue-${outletId}`);
  assert.ok(merchantVisibleDish?.availabilityFlags.includes("Featured"));
});

test("merchant seeded menu is immediately visible from mock user catalog", async () => {
  const outletId = "outlet-wonton-mee";
  const userVisibleVenueId = `mock-venue-${outletId}`;
  const seededDish = (await hungryService.merchant.getMenu(outletId))[0];
  assert.ok(seededDish, "Expected seeded merchant menu dish");

  const userVisibleVenue = await hungryService.discovery.getVenue(userVisibleVenueId);
  const userVisibleDish = await hungryService.discovery.getDish(seededDish.id);

  assert.equal(userVisibleVenue?.id, userVisibleVenueId);
  assert.equal(userVisibleVenue?.topDishId, seededDish.id);
  assert.equal(userVisibleDish?.venueId, userVisibleVenueId);
  assert.equal(userVisibleDish?.venueName, userVisibleVenue?.name);
});

test("merchant profile updates are visible from mock user venue reads", async () => {
  const outletId = "outlet-wonton-mee";
  const userVisibleVenueId = `mock-venue-${outletId}`;
  const seededDish = (await hungryService.merchant.getMenu(outletId))[0];
  assert.ok(seededDish, "Expected seeded merchant menu dish");

  await hungryService.merchant.updateBusinessProfile(outletId, {
    name: "Codex Mock Merchant Stall",
    operatingHours: "9:00 AM – 4:00 PM",
    temporaryClosure: "Closed for cleaning tomorrow",
  });

  const userVisibleVenue = await hungryService.discovery.getVenue(userVisibleVenueId);
  assert.equal(userVisibleVenue?.name, "Codex Mock Merchant Stall");
  assert.equal(userVisibleVenue?.operatingHours, "9:00 AM – 4:00 PM");
  assert.equal(userVisibleVenue?.closureNotice, "Closed for cleaning tomorrow");
  assert.equal(
    (await hungryService.discovery.getDish(seededDish.id))?.venueName,
    "Codex Mock Merchant Stall",
  );

  await hungryService.merchant.updateBusinessProfile(outletId, {
    name: "Uncle Tan's Wonton Mee",
    operatingHours: "7:00 AM – 3:00 PM",
    // Empty clears the notice; undefined means "leave unchanged", as in Supabase.
    temporaryClosure: "",
  });
});

test("merchant OCR draft methods filter drafts and publish accepted dishes", async () => {
  const outletId = "outlet-wonton-mee";
  const beforeMenu = await hungryService.merchant.getMenu(outletId);
  const pendingDrafts = (await hungryService.merchant.getOCRDrafts(outletId)).filter(
    (draft) => draft.status === "pending",
  );

  assert.ok(pendingDrafts.length >= 2, "Expected pending OCR draft fixtures");

  const acceptedDish = await hungryService.merchant.acceptOCRDraft(pendingDrafts[0].id);
  assert.equal(acceptedDish.name, pendingDrafts[0].name);
  assert.equal(acceptedDish.imageUrl, pendingDrafts[0].sourcePhotoUrl);
  assert.deepEqual(acceptedDish.gallery, [pendingDrafts[0].sourcePhotoUrl]);

  const afterAcceptMenu = await hungryService.merchant.getMenu(outletId);
  assert.equal(afterAcceptMenu.length, beforeMenu.length + 1);
  assert.ok(afterAcceptMenu.some((dish) => dish.id === acceptedDish.id));
  assert.equal(
    (await hungryService.discovery.getDish(acceptedDish.id))?.venueId,
    `mock-venue-${outletId}`,
  );
  assert.ok(
    (await hungryService.discovery.listDishesByVenue(`mock-venue-${outletId}`)).some(
      (dish) => dish.id === acceptedDish.id,
    ),
  );

  const afterAcceptDraft = (await hungryService.merchant.getOCRDrafts(outletId)).find(
    (draft) => draft.id === pendingDrafts[0].id,
  );
  assert.equal(afterAcceptDraft?.status, "accepted");

  await hungryService.merchant.rejectOCRDraft(pendingDrafts[1].id);
  const afterRejectDraft = (await hungryService.merchant.getOCRDrafts(outletId)).find(
    (draft) => draft.id === pendingDrafts[1].id,
  );
  assert.equal(afterRejectDraft?.status, "rejected");

  // A repeated accept (double tap) returns the same dish instead of failing or duplicating it.
  const repeated = await hungryService.merchant.acceptOCRDraft(pendingDrafts[0].id);
  assert.equal(repeated.id, acceptedDish.id);
  assert.equal((await hungryService.merchant.getMenu(outletId)).length, afterAcceptMenu.length);

  // "Edit before adding" publishes only on save, with the merchant's edits.
  if (pendingDrafts[2]) {
    const edited = await hungryService.merchant.acceptOCRDraft(pendingDrafts[2].id, {
      name: "Edited scan dish",
      price: 7.5,
      description: "Merchant written description",
      dietaryFlags: ["halal"],
    });
    assert.equal(edited.name, "Edited scan dish");
    assert.equal(edited.price, 7.5);
    assert.equal(edited.description, "Merchant written description");
    assert.deepEqual(edited.dietaryFlags, ["halal"]);
    assert.equal(edited.id, `dish-from-${pendingDrafts[2].id}`);

    // Saving the editor after the draft was already added applies the edits instead of dropping them.
    const reEdited = await hungryService.merchant.acceptOCRDraft(pendingDrafts[2].id, {
      name: "Renamed scan dish",
    });
    assert.equal(reEdited.id, edited.id);
    assert.equal(reEdited.name, "Renamed scan dish");
  }
});

test("merchant AI dish tool methods return canned suggestions without publishing", async () => {
  const beforeMenu = await hungryService.merchant.getMenu("outlet-wonton-mee");

  const description = await hungryService.merchant.generateDishDescription("Wonton Mee", [
    "egg noodles",
    "char siu",
  ]);
  const ingredients = await hungryService.merchant.suggestIngredients("Wonton Mee");
  const allergens = await hungryService.merchant.suggestAllergens([
    "egg noodles",
    "dark soy sauce",
    "sesame oil",
  ]);
  const tags = await hungryService.merchant.suggestTags("Wonton Mee", description);

  assert.match(description, /Wonton Mee/);
  assert.ok(ingredients.includes("egg noodles"));
  assert.deepEqual(allergens, ["Eggs", "Soy", "Gluten", "Sesame"]);
  assert.ok(tags.includes("Savoury"));
  assert.equal(
    (await hungryService.merchant.getMenu("outlet-wonton-mee")).length,
    beforeMenu.length,
  );
});

test("merchant inbox filters interactions by outlet, type, and unreplied status", async () => {
  const outletId = "outlet-wonton-mee";

  const allInteractions = await hungryService.merchant.getInbox(outletId);
  assert.ok(allInteractions.length >= 8);
  assert.ok(allInteractions.every((interaction) => interaction.outletId === outletId));
  assert.ok(
    allInteractions.every((interaction, index) => {
      if (index === 0) return true;
      return (
        new Date(allInteractions[index - 1].createdAt).getTime() >=
        new Date(interaction.createdAt).getTime()
      );
    }),
  );

  const reviews = await hungryService.merchant.getInbox(outletId, { type: "review" });
  assert.ok(reviews.length > 0);
  assert.ok(reviews.every((interaction) => interaction.type === "review"));

  const unreplied = await hungryService.merchant.getInbox(outletId, { unrepliedOnly: true });
  assert.ok(unreplied.length > 0);
  assert.ok(unreplied.every((interaction) => !interaction.reply));
});

test("merchant inbox reply and report methods validate input and persist replies", async () => {
  const outletId = "outlet-wonton-mee";
  const target = (await hungryService.merchant.getInbox(outletId, { unrepliedOnly: true }))[0];
  assert.ok(target, "Expected at least one unreplied interaction");

  await hungryService.merchant.replyToInteraction(target.id, "  Thanks for visiting us.  ");

  const repliedInteraction = (await hungryService.merchant.getInbox(outletId)).find(
    (interaction) => interaction.id === target.id,
  );
  assert.equal(repliedInteraction?.reply?.text, "Thanks for visiting us.");
  assert.ok(repliedInteraction?.reply?.repliedAt);

  await hungryService.merchant.reportInteraction(target.id, " abusive ");
  await assert.rejects(
    hungryService.merchant.replyToInteraction(target.id, " "),
    /Reply text is required/,
  );
  await assert.rejects(
    hungryService.merchant.reportInteraction("missing-interaction", "abusive"),
    /Interaction missing-interaction not found/,
  );
});

test("merchant AI reply generation follows interaction sentiment and question context", async () => {
  const outletId = "outlet-wonton-mee";
  const interactions = await hungryService.merchant.getInbox(outletId);
  const positive = interactions.find((interaction) => interaction.sentiment === "positive");
  const negative = interactions.find((interaction) => interaction.sentiment === "negative");
  const question = interactions.find((interaction) => interaction.type === "question");

  assert.ok(positive);
  assert.ok(negative);
  assert.ok(question);

  assert.match(await hungryService.merchant.generateAIReply(positive.id), /glad you enjoyed/);
  assert.match(await hungryService.merchant.generateAIReply(negative.id), /sorry to hear/);
  assert.match(await hungryService.merchant.generateAIReply(question.id), /checking with us/);
  await assert.rejects(
    hungryService.merchant.generateAIReply("missing-interaction"),
    /Interaction missing-interaction not found/,
  );
});

test("merchant promotion methods filter by outlet and status", async () => {
  const outletId = "outlet-wonton-mee";

  const promotions = await hungryService.merchant.getPromotions(outletId);
  assert.ok(promotions.length >= 4);
  assert.ok(promotions.every((promotion) => promotion.outletId === outletId));
  assert.ok(
    promotions.every((promotion, index) => {
      if (index === 0) return true;
      return (
        new Date(promotions[index - 1].createdAt).getTime() >=
        new Date(promotion.createdAt).getTime()
      );
    }),
  );

  const activePromotions = await hungryService.merchant.getPromotions(outletId, "active");
  assert.ok(activePromotions.length > 0);
  assert.ok(activePromotions.every((promotion) => promotion.status === "active"));
});

test("merchant promotion create and update persist mock state", async () => {
  const outletId = "outlet-wonton-mee";

  const created = await hungryService.merchant.createPromotion(outletId, {
    title: "Codex Draft Promo",
    description: "Draft campaign for service tests.",
    promotionItemType: "existing_menu_item",
    targetDishId: (await hungryService.merchant.getMenu(outletId))[0]?.id,
    originalPrice: 6.5,
    promotionalPrice: 5.5,
    finalPrice: 5.5,
    discountPercentage: 15,
    isAvailable: true,
    startDate: "2026-05-15T03:00:00Z",
    endDate: "2026-05-16T07:00:00Z",
    targetAudience: ["nearby_users"],
    status: "draft",
  });

  assert.match(created.id, /^promo-new-/);
  assert.equal(created.outletId, outletId);
  assert.equal(created.promotionItemType, "existing_menu_item");
  assert.equal(created.finalPrice, 5.5);
  assert.ok(created.createdAt);
  assert.deepEqual(created.analytics, {
    impressions: 0,
    clicks: 0,
    saves: 0,
    profileVisits: 0,
    dishViews: 0,
  });

  const draftPromotions = await hungryService.merchant.getPromotions(outletId, "draft");
  assert.ok(draftPromotions.some((promotion) => promotion.id === created.id));

  const updated = await hungryService.merchant.updatePromotion(created.id, {
    title: "Codex Active Promo",
    status: "active",
    targetAudience: ["nearby_users", "saved_stall_users"],
  });

  assert.equal(updated.title, "Codex Active Promo");
  assert.equal(updated.status, "active");
  assert.deepEqual(updated.targetAudience, ["nearby_users", "saved_stall_users"]);
  assert.ok(
    (await hungryService.merchant.getPromotions(outletId, "active")).some(
      (promotion) => promotion.id === created.id && promotion.title === "Codex Active Promo",
    ),
  );

  const repriced = await hungryService.merchant.updatePromotion(created.id, {
    promotionalPrice: 4.5,
    discountPercentage: 31,
  });
  assert.equal(repriced.promotionalPrice, 4.5);
  assert.equal(repriced.finalPrice, 4.5);

  await assert.rejects(
    hungryService.merchant.createPromotion(outletId, {
      title: "Wrong outlet dish",
      description: "Should not link another outlet's menu item.",
      promotionItemType: "existing_menu_item",
      targetDishId: "dish-from-another-outlet",
      originalPrice: 6.5,
      promotionalPrice: 5.5,
      finalPrice: 5.5,
      discountPercentage: 15,
      isAvailable: true,
      startDate: "2026-05-15T03:00:00Z",
      endDate: "2026-05-16T07:00:00Z",
      targetAudience: ["nearby_users"],
      status: "draft",
    }),
    /this outlet/,
  );

  await assert.rejects(
    hungryService.merchant.updatePromotion("missing-promo", { title: "Missing" }),
    /Promotion missing-promo not found/,
  );
});

test("merchant promotion analytics returns analytics and rejects missing promotion", async () => {
  const activePromotion = (
    await hungryService.merchant.getPromotions("outlet-wonton-mee", "active")
  )[0];
  assert.ok(activePromotion, "Expected at least one active promotion");

  const analytics = await hungryService.merchant.getPromotionAnalytics(activePromotion.id);
  assert.ok(analytics.impressions >= 0);
  assert.ok(analytics.clicks >= 0);
  assert.ok(analytics.saves >= 0);
  assert.ok(analytics.profileVisits >= 0);
  assert.ok(analytics.dishViews >= 0);

  const draftPromotion = (
    await hungryService.merchant.getPromotions("outlet-wonton-mee", "draft")
  )[0];
  assert.ok(draftPromotion, "Expected at least one draft promotion");
  assert.deepEqual(await hungryService.merchant.getPromotionAnalytics(draftPromotion.id), {
    impressions: 0,
    clicks: 0,
    saves: 0,
    profileVisits: 0,
    dishViews: 0,
  });

  await assert.rejects(
    hungryService.merchant.getPromotionAnalytics("missing-promo"),
    /Promotion missing-promo not found/,
  );
});

test("customer active promotions only expose active in-window offers for the current dish", async () => {
  const dish = dishes.find((item) => item.id === "dish-chicken-rice");
  assert.ok(dish, "Expected chicken rice fixture dish");

  const activePromotions = await hungryService.discovery.listActivePromotionsForTarget({
    venueId: dish.venueId,
    dishId: dish.id,
  });

  assert.ok(
    activePromotions.some((promotion) => promotion.id === "promo-1"),
    "Expected active promotion to appear on matching customer detail surfaces",
  );
  assert.equal(
    activePromotions.some((promotion) => promotion.id === "promo-2"),
    false,
    "Scheduled promotions should not appear as customer-active offers",
  );
  assert.equal(
    activePromotions.some((promotion) => promotion.id === "promo-3"),
    false,
    "Expired promotions should not appear as customer-active offers",
  );
  assert.ok(
    activePromotions.every(
      (promotion) => !promotion.targetDishId || promotion.targetDishId === dish.id,
    ),
  );

  const otherDish = dishes.find((item) => item.id !== dish.id && item.venueId !== dish.venueId);
  assert.ok(otherDish, "Expected another fixture dish");
  assert.deepEqual(
    await hungryService.discovery.listActivePromotionsForTarget({
      venueId: otherDish.venueId,
      dishId: otherDish.id,
    }),
    [],
  );
});

test("merchant popular visitor pins stay review-backed, capped, reorderable, and venue-filtered", async () => {
  const outletId = "outlet-wonton-mee";
  const venueId = `mock-venue-${outletId}`;
  const candidates = await hungryService.merchant.listPopularVisitorCandidates(outletId);

  assert.ok(candidates.length >= 7, "Expected enough review-backed visitors for cap coverage");
  assert.ok(candidates.every((candidate) => candidate.reviewId === candidate.sourceId));
  assert.ok(candidates.every((candidate) => candidate.venueId === venueId));

  const initialPins = await hungryService.merchant.listPopularVisitorPins(outletId);
  assert.ok(initialPins.length > 1);
  assert.ok(initialPins.length <= 6);
  assert.ok(
    initialPins.every(
      (pin, index) => index === 0 || initialPins[index - 1].sortOrder <= pin.sortOrder,
    ),
  );
  assert.equal(
    (await hungryService.content.listPopularVisitorPinsByVenue("missing-venue")).length,
    0,
  );
  assert.equal(
    (await hungryService.content.listPopularVisitorPinsByVenue(venueId)).length,
    initialPins.length,
  );

  const firstUnpinned = candidates.find((candidate) => !candidate.isPinned);
  assert.ok(firstUnpinned, "Expected an unpinned review candidate");
  const addedPin = await hungryService.merchant.pinPopularVisitor(outletId, firstUnpinned.reviewId);
  assert.equal(addedPin.reviewId, firstUnpinned.reviewId);
  assert.equal(addedPin.venueId, venueId);
  assert.ok(
    (await hungryService.content.listPopularVisitorPinsByVenue(venueId)).some(
      (pin) => pin.id === addedPin.id,
    ),
  );

  await hungryService.merchant.unpinPopularVisitor(addedPin.id);
  assert.ok(
    !(await hungryService.merchant.listPopularVisitorPins(outletId)).some(
      (pin) => pin.id === addedPin.id,
    ),
  );

  const beforeReorder = await hungryService.merchant.listPopularVisitorPins(outletId);
  const reordered = await hungryService.merchant.reorderPopularVisitorPins(
    outletId,
    beforeReorder
      .slice()
      .reverse()
      .map((pin) => pin.id),
  );
  assert.equal(reordered[0].id, beforeReorder[beforeReorder.length - 1].id);
  assert.ok(reordered.every((pin, index) => pin.sortOrder === index));

  let activePins = await hungryService.merchant.listPopularVisitorPins(outletId);
  for (const candidate of await hungryService.merchant.listPopularVisitorCandidates(outletId)) {
    if (activePins.length >= 6) break;
    if (!activePins.some((pin) => pin.reviewId === candidate.reviewId)) {
      await hungryService.merchant.pinPopularVisitor(outletId, candidate.reviewId);
      activePins = await hungryService.merchant.listPopularVisitorPins(outletId);
    }
  }
  assert.equal(activePins.length, 6);
  const overflowCandidate = (
    await hungryService.merchant.listPopularVisitorCandidates(outletId)
  ).find((candidate) => !activePins.some((pin) => pin.reviewId === candidate.reviewId));
  assert.ok(overflowCandidate, "Expected an overflow candidate beyond the 6 visible pins");
  await assert.rejects(
    hungryService.merchant.pinPopularVisitor(outletId, overflowCandidate.reviewId),
    /up to 6 popular visitors/,
  );
});

test("merchant analytics records dish views without duplicate session increments", async () => {
  const outletId = "outlet-wonton-mee";
  const menu = await hungryService.merchant.getMenu(outletId);
  assert.ok(menu[0], "Expected a merchant menu dish");

  const before = await hungryService.merchant.getAnalytics(outletId, "7d");
  await hungryService.discovery.recordDishView(menu[0].id, { sessionId: "service-methods-view" });
  await hungryService.discovery.recordDishView(menu[0].id, { sessionId: "service-methods-view" });
  const after = await hungryService.merchant.getAnalytics(outletId, "7d");

  assert.equal(after.dishViews, before.dishViews + 1);
  assert.ok(after.topDishes.some((dish) => dish.dishId === menu[0].id && dish.views >= 1));
});

test("merchant analytics records explicit customer action events", async () => {
  const outletId = "outlet-wonton-mee";
  const menu = await hungryService.merchant.getMenu(outletId);
  assert.ok(menu[0], "Expected a merchant menu dish");

  const before = await hungryService.merchant.getAnalytics(outletId, "7d");
  await hungryService.discovery.recordMerchantActionEvent({
    eventType: "stall_profile_view",
    outletId,
    dishId: menu[0].id,
    sessionId: "service-methods-action-profile",
  });
  await hungryService.discovery.recordMerchantActionEvent({
    eventType: "menu_view",
    outletId,
    dishId: menu[0].id,
    sessionId: "service-methods-action-menu",
  });
  await hungryService.discovery.recordMerchantActionEvent({
    eventType: "direction_tap",
    outletId,
    dishId: menu[0].id,
    sessionId: "service-methods-action-direction",
  });
  await hungryService.discovery.recordMerchantActionEvent({
    eventType: "contact_tap",
    outletId,
    dishId: menu[0].id,
    sessionId: "service-methods-action-contact",
  });
  await hungryService.discovery.recordMerchantActionEvent({
    eventType: "social_link_tap",
    outletId,
    dishId: menu[0].id,
    sessionId: "service-methods-action-social",
  });
  await hungryService.discovery.recordMerchantActionEvent({
    eventType: "save",
    outletId,
    dishId: menu[0].id,
    sessionId: "service-methods-action-save",
  });
  await hungryService.discovery.recordMerchantActionEvent({
    eventType: "share",
    outletId,
    dishId: menu[0].id,
    sessionId: "service-methods-action-share",
  });
  const after = await hungryService.merchant.getAnalytics(outletId, "7d");

  assert.equal(after.profileVisits, before.profileVisits + 1);
  assert.equal(after.menuViews, before.menuViews + 1);
  assert.equal(after.directionTaps, before.directionTaps + 1);
  assert.equal(after.contactTaps, before.contactTaps + 1);
  assert.equal(after.socialLinkTaps, before.socialLinkTaps + 1);
  assert.equal(after.saves, before.saves + 1);
  assert.equal(after.shares, before.shares + 1);
  assert.ok(after.topDishes.some((dish) => dish.dishId === menu[0].id && dish.saves >= 1));
});

test("merchant weekly summary stats are read-only and notifications are deduped", async () => {
  const account = await hungryService.merchant.getMerchantAccount();
  assert.ok(account);
  const outletId = "outlet-wonton-mee";

  const weeklySummary = await hungryService.merchant.getWeeklySummaryStats(outletId);
  assert.ok(weeklySummary.totalViews >= weeklySummary.dishViews);

  const allNotifications = await hungryService.merchant.getMerchantNotifications(account.id);
  const dedupeKeys = new Set(allNotifications.map((notification) => notification.dedupeKey));
  assert.equal(dedupeKeys.size, allNotifications.length);
});

test("merchant AI assistant returns insight slices and weekly summary", async () => {
  const outletId = "outlet-wonton-mee";

  const allInsights = await hungryService.merchant.getAIInsights(outletId);
  assert.ok(allInsights.length >= 6);
  assert.ok(allInsights.every((insight) => insight.outletId === outletId));
  assert.ok(allInsights.every((insight) => !insight.isDismissed));

  const weeklySummary = await hungryService.merchant.getWeeklySummary(outletId);
  assert.equal(weeklySummary.type, "weekly_summary");
  assert.match(weeklySummary.body, /Profile visits/);

  const profileSuggestions = await hungryService.merchant.getProfileSuggestions(outletId);
  assert.ok(profileSuggestions.length > 0);
  assert.ok(profileSuggestions.every((insight) => insight.type === "profile_improvement"));

  const menuSuggestions = await hungryService.merchant.getMenuCleanupSuggestions(outletId);
  assert.ok(menuSuggestions.length > 0);
  assert.ok(
    menuSuggestions.every((insight) =>
      ["menu_cleanup", "photo_enhancement"].includes(insight.type),
    ),
  );

  const demandInsights = await hungryService.merchant.getDemandInsights(outletId);
  assert.ok(demandInsights.length > 0);
  assert.ok(
    demandInsights.every((insight) => ["demand_insight", "promotion_tip"].includes(insight.type)),
  );
});

test("merchant AI assistant rejects unknown outlet", async () => {
  await assert.rejects(
    hungryService.merchant.getAIInsights("missing-outlet"),
    /Outlet missing-outlet not found/,
  );
  await assert.rejects(
    hungryService.merchant.getWeeklySummary("missing-outlet"),
    /Outlet missing-outlet not found/,
  );
});

test("merchant settings team methods persist members and role changes", async () => {
  const account = await hungryService.merchant.getMerchantAccount();
  assert.ok(account);

  const beforeMembers = await hungryService.merchant.getTeamMembers(account.id);
  const addedMember = await hungryService.merchant.addTeamMember(
    account.id,
    " NewStaff@Hawker.sg ",
    "staff",
    "New Staff",
  );

  assert.match(addedMember.id, /^tm-new-/);
  assert.equal(addedMember.email, "newstaff@hawker.sg");
  assert.equal(addedMember.displayName, "New Staff");
  assert.equal(addedMember.role, "staff");
  assert.equal(addedMember.inviteStatus, "pending");

  await hungryService.merchant.updateTeamMemberRole(addedMember.id, "manager");
  const afterRoleUpdate = await hungryService.merchant.getTeamMembers(account.id);
  assert.equal(afterRoleUpdate.find((member) => member.id === addedMember.id)?.role, "manager");

  await hungryService.merchant.removeTeamMember(addedMember.id);
  const afterRemove = await hungryService.merchant.getTeamMembers(account.id);
  assert.equal(afterRemove.length, beforeMembers.length);
  assert.ok(!afterRemove.some((member) => member.id === addedMember.id));
});

test("merchant settings team methods validate duplicates and protected owner role", async () => {
  const account = await hungryService.merchant.getMerchantAccount();
  assert.ok(account);

  const owner = (await hungryService.merchant.getTeamMembers(account.id)).find(
    (member) => member.role === "owner",
  );
  assert.ok(owner, "Expected owner team member");

  await assert.rejects(
    hungryService.merchant.addTeamMember(account.id, owner.email.toUpperCase(), "staff", "Owner"),
    /already exists/,
  );
  await assert.rejects(
    hungryService.merchant.addTeamMember(account.id, "not-an-email", "staff", "Invalid"),
    /Valid team member email is required/,
  );
  await assert.rejects(
    hungryService.merchant.addTeamMember(account.id, "valid@example.test", "staff", ""),
    /Team member name is required/,
  );
  await assert.rejects(
    hungryService.merchant.updateTeamMemberRole(owner.id, "manager"),
    /Owner role cannot be changed/,
  );
  await assert.rejects(
    hungryService.merchant.removeTeamMember(owner.id),
    /Owner team member cannot be removed/,
  );
  await assert.rejects(
    hungryService.merchant.getTeamMembers("missing-account"),
    /Merchant account missing-account not found/,
  );
});

test("merchant settings notification preferences persist partial updates", async () => {
  const account = await hungryService.merchant.getMerchantAccount();
  assert.ok(account);

  const beforePrefs = await hungryService.merchant.getNotificationPreferences(account.id);
  assert.equal(beforePrefs.newReviews, true);

  await hungryService.merchant.updateNotificationPreferences(account.id, {
    newReviews: false,
    aiInsights: false,
  });

  const afterPrefs = await hungryService.merchant.getNotificationPreferences(account.id);
  assert.equal(afterPrefs.newReviews, false);
  assert.equal(afterPrefs.aiInsights, false);
  assert.equal(afterPrefs.weeklyDigest, beforePrefs.weeklyDigest);

  await assert.rejects(
    hungryService.merchant.updateNotificationPreferences("missing-account", {
      weeklyDigest: false,
    }),
    /Merchant account missing-account not found/,
  );
});
