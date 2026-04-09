# Lessons

- Figma is the visual source of truth for any screen that already exists there; do not preserve an older in-app layout when it conflicts with the approved design.
- Do not leave guest browsing branches in the runtime once product direction changes to auth-first; remove them from the session model, soft-gate copy, and debug presets together.
- Avoid colored pills and emoji-driven UI copy in Hungry. Use warm neutral surfaces, restrained semantic color, and icon/text hierarchy instead.
- When auth becomes mandatory, delete or fully retire the old soft-gate surface instead of leaving an unused auth sheet in the runtime path.
- Do not silently fall back to arbitrary mock entities on compose flows. If the selected record is missing, stop the flow and send the user back to a safe picker state.
- When discovery data comes from both Singapore geo datasets and older mock fixtures, bridge building IDs at the repository boundary instead of letting map, floor-plan, and venue flows each guess their own alias mapping.
- Mall drill-down UX cannot be list-first if the requirement is store-directory realism; use polygon-first floor maps with synced selection state and a vertical floor selector.
- For map+sheet composition, keep the map canvas as the constant background and use a real draggable bottom sheet; static overlays that only look like sheets fail UX expectations immediately.
- For mall drill-down realism, never freehand synthetic grids: anchor polygons to official mall floor-map assets, preserve real unit numbers, and keep list-map IDs one-to-one.
- For directory maps, rely on computed fit-to-viewport base scale plus explicit zoom controls; fixed hardcoded scale values break cross-mall standardization and make alignment QA unreliable.
- For mixed single-tap and double-tap UX in feed cards, use exclusive gesture recognizers on the text region so like and expand actions never fire together.
- For repeated form flows (auth/reset), centralize validation rules in shared helpers and test those helpers directly so every screen stays consistent when requirements change.
