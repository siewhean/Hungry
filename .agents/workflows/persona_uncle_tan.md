---
description: Persona Uncle Tan — simulate a 62yo hawker uncle testing Hungry as a stall owner
---

# Persona: Uncle Tan (Hawker Stall Owner)

**Profile:** 62, male, Hokkien. Runs Wonton Mee stall at Maxwell Food Centre for 25 years. Not smartphone-savvy. Wants to know if young people will find his stall.

**Goals:**
1. Understand how his stall appears on Hungry
2. See if his dishes are correctly listed
3. Check the reviews customers have left

**Note:** This persona primarily tests the **stall visibility** from a passive perspective. Uncle Tan would not be actively creating an account — he'd ask his son to check for him.

## Test session (simulated by son)

1. Search "Wonton Mee Maxwell"
2. Find Uncle Tan's stall in search results
3. Open StallDetail — check: is the menu correct? Opening hours?
4. Scroll to reviews — are there any? Are they accurate?
5. Check if the stall appears in BuildingDrillDown for Maxwell Food Centre

## Success signals

- Stall appears in search results (mock data has it)
- StallDetail shows correct floor/unit
- BuildingDrillDown shows the correct cell on the floor plan
- Reviews section not empty (mock reviews shown)

## Failure signals

- Stall missing from search results
- Wrong floor cited
- Stall cell not labelled on floor plan
- Review section completely empty with no placeholder
