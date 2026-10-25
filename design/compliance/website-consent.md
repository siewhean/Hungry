# Website consent and form safeguards — 25 October 2026

Source: existing `marketing/website/website v2/waitlist-wireframe.md` form contract, website CSS tokens, and the user's consumer safeguards request.

- Non-modal bottom consent region, readable navy text on white; same-size, same-style Accept analytics / Reject analytics buttons. Essential storage works regardless. Explain optional analytics and link to /cookies.
- Keep Cookie preferences available as a native button after dismissal; no focus trap or content blockade. Choices last six months locally. Storage failures apply the choice for this tab and disclose that it cannot be remembered. Honor Global Privacy Control and Do Not Track by keeping analytics off.
- Analytics component and custom events must check valid affirmative consent. Unknown, invalid, expired, rejected, private merchant/console routes and privacy signals mean off. Revocation stops subsequent sends, including from an already loaded script.
- Waitlist: email required; name optional; merchant business details optional for initial interest. An unchecked required checkbox confirms 18+ (launch product rule; no date of birth), a separate unchecked checkbox asks only for selected-list early-access email. No wider marketing bundle.
- Merchant account creation: unchecked 18+ and terms checkbox, privacy notice; no automatic addition to marketing/waitlist. Actual server response governs success.
- All controls use visible labels, native keyboard behavior, focus-visible styles and inline error/status feedback. Review against these criteria and existing waitlist layout after implementation.
