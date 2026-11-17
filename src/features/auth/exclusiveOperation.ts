/** Reject concurrent submissions before React has committed disabled controls. */
export function createExclusiveOperation(onBusyChange: (busy: boolean) => void = () => undefined) {
  let locked = false;
  return async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (locked) return undefined;
    locked = true;
    onBusyChange(true);
    try {
      return await operation();
    } finally {
      locked = false;
      onBusyChange(false);
    }
  };
}
