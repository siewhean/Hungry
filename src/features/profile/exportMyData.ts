import { SUPPORT_EMAIL } from "@/constants/links";
import type { HungryService } from "@/lib/services/types";

/**
 * PDPA access request: a copy of the signed-in user's own data. The service reads it in one
 * call scoped to the signed-in user and throws on any failure, so the export is never silently
 * partial. `categories` lists what is included and `notIncluded` what is not.
 */
export async function buildMyDataExport(service: Pick<HungryService, "profile">) {
  const exported = await service.profile.exportMyData();
  return {
    ...exported,
    otherDataRequests: `For any other personal data Hungry holds, email ${SUPPORT_EMAIL}.`,
  };
}
