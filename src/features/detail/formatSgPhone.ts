/**
 * "+6591234567" or "91234567" -> "+65 9123 4567". Only a Singapore number (8 digits starting
 * 3, 6, 8 or 9, with or without +65) is regrouped; anything else is shown as written, so a
 * foreign or unusual number is never mangled.
 */
export function formatSgPhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[\s()-]/g, "");
  const local = /^\+?65(\d{8})$/.exec(digits)?.[1] ?? (/^\d{8}$/.test(digits) ? digits : undefined);
  if (!local || !/^[3689]/.test(local)) return trimmed;
  return `+65 ${local.slice(0, 4)} ${local.slice(4)}`;
}
