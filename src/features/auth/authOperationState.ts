let activeOperations = 0;
const listeners = new Set<() => void>();
export const getAuthOperationCount = () => activeOperations;
export const subscribeAuthOperations = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
/** Auth events may arrive before the interactive screen has hydrated drafts or
 * finished recovery. Automatic navigation waits for the full operation. */
export function beginAuthOperation(): () => void {
  activeOperations++;
  listeners.forEach((listener) => listener());
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeOperations--;
    listeners.forEach((listener) => listener());
  };
}
