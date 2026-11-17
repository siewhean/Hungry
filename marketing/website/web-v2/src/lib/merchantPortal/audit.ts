import { supabaseFetch } from "@/lib/supabase/server";
import type { MerchantPortalOverview } from "@/lib/supabase/websiteData";

type MerchantAuditInput = {
  action: string;
  metadata?: Record<string, unknown>;
  overview: MerchantPortalOverview;
  targetId?: string;
  targetType: string;
};

export async function writeMerchantAuditLog({
  action,
  metadata = {},
  overview,
  targetId,
  targetType,
}: MerchantAuditInput) {
  await supabaseFetch("rest/v1/merchant_audit_logs", {
    body: {
      action,
      actor_user_id: overview.user.id,
      merchant_account_id: overview.account.id,
      metadata,
      outlet_id: overview.outlet.id,
      target_id: targetId ?? null,
      target_type: targetType,
    },
    method: "POST",
    prefer: "return=minimal",
    serviceRole: true,
  });
}
