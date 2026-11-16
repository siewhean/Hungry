// Reads `supabase secrets list -o json` on stdin and reports required secret names that are missing.
// Prints names only. Exit 1 when any required name is missing.
import { missingSecrets, requiredSecretNames } from "./manifest.mjs";

export function namesFromList(json) {
  const rows = JSON.parse(json);
  if (!Array.isArray(rows)) throw new Error("expected a JSON array from `supabase secrets list -o json`");
  return rows.map((row) => String(row.name ?? row.NAME ?? ""));
}

if (process.argv[1]?.endsWith("check-secrets.mjs")) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const missing = missingSecrets(namesFromList(Buffer.concat(chunks).toString("utf8")));
  console.log(`${requiredSecretNames().length - missing.length} of ${requiredSecretNames().length} required secrets are set.`);
  if (missing.length > 0) {
    console.error(`Missing: ${missing.join(", ")}`);
    process.exit(1);
  }
}
