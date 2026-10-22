# Native Laksa attribution follow-up

Observed on the RouteQA candidate: search suggested Signature Laksa at Katong Laksa Maxwell, but the resulting dish detail attributed it to Tian Tian and included Chicken Rice/Pandan Cake in its venue menu.

Cause: the canonical mock `dish-laksa.venueId` incorrectly referenced `venue-tian-tian`, despite its own name/unit declaring Katong Laksa Maxwell/#01-04. Detail correctly followed that incorrect ID. A bounded scan found the same ownership mismatch for Kaya Toast/Ah Seng Toast versus its fish-soup venue ID.

Repairs: added the two intended canonical venue fixtures using existing dish metadata, corrected only their two venue references, preserved existing fixture order, and left unprovided opening hours unknown. Detail now resolves attribution and related menu through `getDishVenueContext`; wrong-venue cache/menu entries are rejected, and hydrated detail rows must match the current routed IDs.

Verification: 47 focused service/detail tests passed; see `native-attribution-regression.log`. Functional regressions follow service search → routed Laksa → canonical venue/menu, enforce all actual dish fixture ownership metadata, and reject another venue's cached attribution/menu. Scoped ESLint, formatting for changed detail files and diff checks passed.

Fresh native bundle/install and repeating the observed journey remain necessary. Source tests do not certify the previously installed candidate.
