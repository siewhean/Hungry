# Store Layout Editor Agent Notes

## Goal
- Trace store polygons on top of directory floor-plan images.
- Keep geometry export deterministic and machine-readable.

## Constraints
- All store shapes are persisted as polygons.
- Coordinates are saved in image-space units (post-calibration image pixels).
- Editing actions must be undoable and redoable.

## Engineering Rules
- Keep feature logic inside `src/features/*`.
- Keep rendering and UI state wiring inside `src/components/*` and `src/App.tsx`.
- Do not couple export logic to DOM state; export only from typed data models.

## Validation
- `npm run typecheck`
- `npm run build`
