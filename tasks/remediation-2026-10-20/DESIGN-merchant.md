# Merchant remediation interaction specification

Governing direction: `design/stitch/DESIGN.md`, existing token system, and approved repair-and-simplify plan. Keep current merchant hierarchy and production gates.

- Editors retain entered values on failure, prevent duplicate submission and confirm actual route removal while dirty. Explicit Remove clears an image; unchanged owned media and unrelated flags survive saving. Dish tags are named Taste tags, not ingredients. No simulated allergen all-clear or unsupported AI opportunity promise.
- Monetary fields accept a complete SGD decimal with at most two fractional digits; blank/invalid input is an inline validation error, never implicitly free. Zero requires explicit entry.
- OCR capture uploads a real selected menu photo through existing supply ingestion. Extraction is queued, not instantly promised. Draft correction is local until Add to menu; Back creates no canonical dish. Batch reports exact accepted/failed totals and retains failures.
- Loading/empty/failed states are distinct. Requests and mutations are scoped to the selected outlet; late responses never replace another outlet's state. A single in-flight mutation protects reorder/preferences sequences. Errors preserve input and offer retry.
- Home verification requires at least three evidence images and explicit declaration. Home-location public privacy is unavailable until independently verified server projections; no unproved hidden-address promise. Rejected/more-info statuses show actual feedback and refresh. Evidence progress and failed submission remain visible.
- Customer preview requires an authoritative linked venue, never a neighboring building fallback. Review originals open known venue/dish context. Unsupported comment/mention categories and simulated AI replies are not offered in live mode.
- Promotions use Singapore date boundaries. Editing preserves unchanged existing instants. Queue feedback says queued, not delivered. Analytics shows true zero and correct local clock labels; illustrations explicitly say unavailable, not Order Here.
- All custom controls expose labels, roles, selected/checked/busy states; reply sheets use keyboard avoidance, modal semantics and draft-preserving close behavior. Native layout, assistive technology and live backend acceptance remain separate required checks.
