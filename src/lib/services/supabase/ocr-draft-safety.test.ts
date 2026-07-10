import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function serviceBlock(source: string, name: string, nextName: string): string {
  const match = source.match(
    new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\},\\n\\n  ${nextName}:`),
  );
  assert.ok(match, `Expected ${name} service block before ${nextName}`);
  return match[1];
}

test("consumer Supabase reads never query OCR draft dishes", () => {
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const beforeSupply = service.split("\n  supply: {")[0];

  assert.doesNotMatch(repository, /dishes_draft/);
  assert.match(repository, /client\.from\("dishes"\)\.select\("\*"\)/);
  assert.match(service, /getDishByIdViaRpc\(id\)/);
  assert.match(service, /listDishesByVenueViaRpc\(venueId\)/);
  assert.match(service, /searchDishesViaRpc\(filters,\s*tasteProfile\)/);
  assert.doesNotMatch(beforeSupply, /dishes_draft/);
  assert.doesNotMatch(beforeSupply, /listDraftDishesQueue/);
  assert.doesNotMatch(beforeSupply, /getOCRDrafts/);
});

test("OCR draft table access is confined to supply, merchant, and ops-admin paths", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const supply = serviceBlock(service, "supply", "merchant");
  const merchant = serviceBlock(service, "merchant", "recommendations");
  const opsFunction = read("supabase/functions/ops-dishes-draft/index.ts");
  const hardening = read("supabase/migrations/0038_app_security_hardening.sql");

  assert.match(supply, /functions\.invoke\("ops-dishes-draft"/);
  assert.match(supply, /listDraftDishesQueue/);
  assert.doesNotMatch(supply, /\.from\("dishes_draft"\)/);
  assert.match(merchant, /getOCRDrafts/);
  assert.match(merchant, /acceptOCRDraft/);
  assert.match(merchant, /rejectOCRDraft/);
  assert.match(merchant, /\.from\("dishes_draft"\)/);
  assert.match(merchant, /requireLinkedMerchantOutlet\(client,\s*outletId\)/);
  assert.match(opsFunction, /requireAuthenticatedOpsUser/);
  assert.match(opsFunction, /app_ops_admins/);
  assert.match(opsFunction, /app_can_make_ops_request/);
  assert.match(opsFunction, /OPS_DISHES_DRAFT_ALLOWED_ORIGINS/);
  assert.doesNotMatch(opsFunction, /x-ops-api-key/);
  assert.match(hardening, /app_ops_admins/);
  assert.match(
    hardening,
    /grant execute on function public\.app_can_make_ops_request[\s\S]*to service_role/,
  );
});
