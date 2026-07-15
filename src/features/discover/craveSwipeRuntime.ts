export function saveCurrentCraveDish<T>(dish: T | undefined, saveDish: (dish: T) => void) {
  if (!dish) return false;
  saveDish(dish);
  return true;
}
