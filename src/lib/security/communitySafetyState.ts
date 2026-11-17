/** Account-scoped, reactive visibility state. Names are presentation, never identity. */
const hiddenIds = new Set<string>();
const blockedIds = new Set<string>();
const listeners = new Set<() => void>();
let revision = 0;
let generation = 0;
function emit() {
  revision += 1;
  listeners.forEach((listener) => listener());
}
export const communitySafetyState = {
  hiddenIds,
  blockedIds,
  getRevision: () => revision,
  getGeneration: () => generation,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  hide(id: string) {
    hiddenIds.add(id);
    emit();
  },
  block(id: string) {
    blockedIds.add(id);
    emit();
  },
  hydrate(ids: string[], expectedGeneration: number) {
    if (expectedGeneration !== generation) return;
    ids.forEach((id) => blockedIds.add(id));
    emit();
  },
  reset() {
    generation += 1;
    hiddenIds.clear();
    blockedIds.clear();
    emit();
  },
};
