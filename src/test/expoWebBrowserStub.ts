export function maybeCompleteAuthSession(): void {}

export async function openAuthSessionAsync() {
  return { type: "dismiss" as const };
}
