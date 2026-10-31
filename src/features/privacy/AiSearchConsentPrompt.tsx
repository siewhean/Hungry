import { Dialog } from "@/components/ui";
import { reportError } from "@/lib/monitoring/reportError";
import { useConsentStore } from "@/store/useConsentStore";
import { useUIStore } from "@/store/useUIStore";

import { setAiSearchConsent } from "./consent";

/**
 * The "sent to Anthropic" notice before AI search (App Review 5.1.2(i)), opened by
 * `ensureAiSearchConsent`. Mounted once for the whole app. Allowing saves the choice on the
 * account first; if that fails the search does not go ahead.
 */
export function AiSearchConsentPrompt() {
  const notice = useConsentStore((state) => state.aiSearchNotice);
  const closeNotice = useConsentStore((state) => state.closeAiSearchNotice);
  const showToast = useUIStore((state) => state.showToast);

  const settle = (allowed: boolean) => {
    const current = useConsentStore.getState().aiSearchNotice;
    closeNotice();
    current?.answer(allowed);
  };

  const allow = () => {
    void setAiSearchConsent(true)
      .then(() => settle(true))
      .catch((error: unknown) => {
        reportError(error, { area: "consent_ai_search_save" });
        showToast({ message: "Couldn't save that. Please try again.", tone: "error" });
        settle(false);
      });
  };

  return (
    <Dialog
      visible={notice !== null}
      title="Use AI to understand your search?"
      message="To understand searches like “something soupy and mild”, Hungry sends the words you type to Anthropic, an AI company. Your name, email and account details are not sent. You can turn this off any time in Settings under Privacy & data."
      buttons={[
        { text: "Allow AI search", style: "default", onPress: allow },
        { text: "Not now", style: "default", onPress: () => settle(false) },
      ]}
      onClose={() => undefined}
    />
  );
}
