export const VERIFICATION_CODE_LENGTH = 8;
export function isVerificationCode(value: string) {
  return /^\d{8}$/.test(value.trim());
}
export function remainingCooldownSeconds(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
