/** Thrown when the signed-in account has no email address to send a deletion code to. */
export const NO_ACCOUNT_EMAIL_MESSAGE = "This account has no email address to send a code to.";

export function isNoAccountEmailError(error: unknown): boolean {
  return error instanceof Error && error.message === NO_ACCOUNT_EMAIL_MESSAGE;
}
