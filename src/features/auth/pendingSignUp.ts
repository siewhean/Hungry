/**
 * In-memory hand-off between sign-up and email verification.
 *
 * When Supabase requires email confirmation, sign-up returns no session. The
 * verification screen can finish sign-in with these credentials once the user
 * confirms their email. They live only in module memory: never persisted, lost
 * on app restart (the screen then routes the user to Login instead).
 */
export interface PendingSignUp {
  email: string;
  password: string;
  completedOnboarding: boolean;
}

let pendingSignUp: PendingSignUp | null = null;

export function setPendingSignUp(value: PendingSignUp): void {
  pendingSignUp = { ...value, email: value.email.trim() };
}

export function getPendingSignUp(email?: string): PendingSignUp | null {
  if (!pendingSignUp) return null;
  if (email && pendingSignUp.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  return pendingSignUp;
}

export function clearPendingSignUp(): void {
  pendingSignUp = null;
}
