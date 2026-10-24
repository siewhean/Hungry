// Lines that have typed in already. Coming back to a screen (Back from the next question) shows its
// line at once: the typing is a first-visit effect, not a wait on every return.
const typed = new Set<string>();

export function hasTypedLine(id: string): boolean {
  return typed.has(id);
}

export function markTypedLine(id: string): void {
  typed.add(id);
}

export function resetTypedLines(): void {
  typed.clear();
}
