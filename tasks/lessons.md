# Lessons

- Figma is the visual source of truth for any screen that already exists there; do not preserve an older in-app layout when it conflicts with the approved design.
- Do not leave guest browsing branches in the runtime once product direction changes to auth-first; remove them from the session model, soft-gate copy, and debug presets together.
- Avoid colored pills and emoji-driven UI copy in Hungry. Use warm neutral surfaces, restrained semantic color, and icon/text hierarchy instead.
- When auth becomes mandatory, delete or fully retire the old soft-gate surface instead of leaving an unused auth sheet in the runtime path.
- Do not silently fall back to arbitrary mock entities on compose flows. If the selected record is missing, stop the flow and send the user back to a safe picker state.
- When discovery data comes from both Singapore geo datasets and older mock fixtures, bridge building IDs at the repository boundary instead of letting map, floor-plan, and venue flows each guess their own alias mapping.
