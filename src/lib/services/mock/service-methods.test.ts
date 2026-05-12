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

test("auth.requestAccountDeletion clears mock session", async () => {
  await hungryService.auth.signIn("delete-me@hungry.sg", "password");
  await hungryService.auth.requestAccountDeletion({
    userId: "mock-user",
    reason: "test",
  });

  const session = await hungryService.auth.getCurrentSession();
  assert.equal(session, null);
});

test("merchant menu methods persist CRUD and status toggles in mock state", async () => {
  const outletId = "outlet-wonton-mee";
  const beforeMenu = await hungryService.merchant.getMenu(outletId);

  const addedDish = await hungryService.merchant.addDish(outletId, {
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

  const editedDish = await hungryService.merchant.editDish(outletId, addedDish.id, {
    price: 8,
    priceRange: "S$8.00",
  });
  assert.equal(editedDish.price, 8);
  assert.equal(editedDish.priceRange, "S$8.00");
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

  assert.equal(await hungryService.merchant.toggleFeatured(outletId, addedDish.id), true);
  assert.ok(
    (await hungryService.merchant.getMenu(outletId))
      .find((dish) => dish.id === addedDish.id)
      ?.availabilityFlags.includes("Featured"),
  );

  await hungryService.merchant.deleteDish(outletId, addedDish.id);
  const afterDelete = await hungryService.merchant.getMenu(outletId);
  assert.equal(afterDelete.length, beforeMenu.length);
  assert.ok(!afterDelete.some((dish) => dish.id === addedDish.id));
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

  const afterAcceptDraft = (await hungryService.merchant.getOCRDrafts(outletId)).find(
    (draft) => draft.id === pendingDrafts[0].id,
  );
  assert.equal(afterAcceptDraft?.status, "accepted");

  await hungryService.merchant.rejectOCRDraft(pendingDrafts[1].id);
  const afterRejectDraft = (await hungryService.merchant.getOCRDrafts(outletId)).find(
    (draft) => draft.id === pendingDrafts[1].id,
  );
  assert.equal(afterRejectDraft?.status, "rejected");
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
    startDate: "2026-05-15T03:00:00Z",
    endDate: "2026-05-16T07:00:00Z",
    targetAudience: ["nearby_users"],
    status: "draft",
  });

  assert.match(created.id, /^promo-new-/);
  assert.equal(created.outletId, outletId);
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
  );

  assert.match(addedMember.id, /^tm-new-/);
  assert.equal(addedMember.email, "newstaff@hawker.sg");
  assert.equal(addedMember.role, "staff");

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
    hungryService.merchant.addTeamMember(account.id, owner.email.toUpperCase(), "staff"),
    /already exists/,
  );
  await assert.rejects(
    hungryService.merchant.addTeamMember(account.id, "not-an-email", "staff"),
    /Valid team member email is required/,
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
