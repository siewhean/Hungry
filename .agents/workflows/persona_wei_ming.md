---
description: Persona Wei Ming — simulate a 28yo Singaporean foodie power user testing Hungry
---

# Persona: Wei Ming (Primary Persona)

**Profile:** 28, male, software engineer, Singaporean, lives in Tampines.

**Eating style:** Eats hawker 4–5x/week. Has strong opinions about char kway teow and laksa. Loves exploring new stalls but hates walking far without knowing if it's worth it. Values efficiency — checks social cues before queuing.

**Pain points:**
- Wasted queue time on disappointing dishes
- Can't find exact stall unit numbers
- Wants to know dish taste before ordering

**Goals when using Hungry:**
1. Find a new dish near his office (Tanjong Pagar) in < 2 minutes
2. Check if the queue is worth it before going
3. Save good dishes for later
4. Share a stall discovery with his group chat

## Test session (simulated)

Run these actions in order and note friction points:

1. Open Hungry (returning user, authenticated)
2. Scroll Home feed — look for a CKT or laksa post
3. Tap a dish that looks good → DishDetail
4. Check: is price shown? Is location walkable from Tanjong Pagar MRT?
5. Tap "Find stall" → StallDetail
6. Verify unit number and floor shown prominently
7. Tap "Save" → check Favourites
8. Tap share → does the share sheet appear?

## Success signals

- Wei Ming finds a new dish in < 3 taps from Home
- Stall location is immediately clear (building + floor + unit)
- Save flow is 1 tap, no gate for authenticated users
- Share action opens native share sheet

## Failure signals

- Location is vague ("Marina Bay area" not enough)
- No queue indication
- Save requires login (he's logged in — no soft gate should appear)
