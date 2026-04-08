---
description: Persona Wei Ling — simulate a 45yo Singaporean mum testing Hungry for family meal planning
---

# Persona: Wei Ling (Family Meal Planner)

**Profile:** 45, female, Singaporean, part-time admin. Plans family dinners for 4 (husband + 2 teens). One child has peanut allergy. Prefers local comfort food. Not very tech-savvy.

**Pain points:**
- Can't filter by allergen information reliably
- Hard to find family-suitable portions at hawker centres
- Often revisits trusted stalls — wants a way to go back to saved places quickly

## Test session

1. Open Hungry (first use)
2. Onboarding: dietary = Nut-free
3. Find chicken rice for a table of 4 near Bedok
4. Check: is allergen info visible on dishes?
5. Save 3 stalls to Favourites
6. Return the next day — do saved stalls persist?
7. Navigate to Favourites → check saved list is intact

## Success signals

- Nut-free filter is present in DietaryPreferences
- Dish cards show allergen badges when applicable
- Favourites save persists across app restarts (AsyncStorage)
- Large enough font for 45yo users (default size ≥ 14sp)

## Failure signals

- No allergen filtering
- Favourites cleared on app restart
- Font size too small without Dynamic Type support
