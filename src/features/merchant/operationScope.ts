/** Invalidates captured operations even when an outlet/account changes away and back. */
export function createMerchantOperationScope(initialIdentity: string) {
  let identity = initialIdentity;
  let generation = 0;
  let active = true;
  return {
    update(nextIdentity: string) {
      if (identity !== nextIdentity) {
        identity = nextIdentity;
        generation += 1;
      }
    },
    open() {
      active = true;
    },
    close() {
      active = false;
      generation += 1;
    },
    capture() {
      const captured = generation;
      return () => active && captured === generation;
    },
  };
}
