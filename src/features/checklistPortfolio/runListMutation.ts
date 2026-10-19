import { useUIStore } from "@/store/useUIStore";

/**
 * Runs a checklist/portfolio write and tells the user how it went, so a failed
 * write is never silent. Returns whether it succeeded.
 */
export async function runListMutation(
  action: () => Promise<unknown>,
  messages: { success?: string; failure: string },
): Promise<boolean> {
  try {
    await action();
  } catch (error) {
    console.error(messages.failure, error);
    // Short store/service messages (e.g. "already in this checklist") are worth showing.
    const detail =
      error instanceof Error && error.message && error.message.length <= 100
        ? ` ${error.message}`
        : "";
    useUIStore.getState().showToast({ message: `${messages.failure}${detail}`, tone: "error" });
    return false;
  }
  if (messages.success) {
    useUIStore.getState().showToast({ message: messages.success, tone: "success" });
  }
  return true;
}
