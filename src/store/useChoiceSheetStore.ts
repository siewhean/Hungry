import { create } from "zustand";

export type ChoiceOption = {
  id: string;
  label: string;
  /** Shown in red, for an action that cannot be undone. */
  destructive?: boolean;
};

export type ChoiceRequest = {
  title: string;
  message?: string;
  options: readonly ChoiceOption[];
  resolve: (choice: string | null) => void;
};

type ChoiceSheetState = {
  request: ChoiceRequest | null;
  /** True from the moment a question is asked until the sheet has fully left the screen. */
  sheetOpen: boolean;
  /** Called by the host when an option is tapped (its id) or the sheet is dismissed (null). */
  settle: (choice: string | null) => void;
};

export const useChoiceSheetStore = create<ChoiceSheetState>((set, get) => ({
  request: null,
  sheetOpen: false,
  settle: (choice) => {
    const request = get().request;
    if (!request) return;
    set({ request: null });
    request.resolve(choice);
  },
}));

/** Waiters for the sheet to be gone, and the longest any of them waits (no host mounted). */
const closeWaiters = new Set<() => void>();
const SHEET_CLOSED_FALLBACK_MS = 800;
/** Lets UIKit finish dismissing the sheet's modal before something else is presented. */
const SHEET_CLOSED_SETTLE_MS = 80;

/** Called by the host once the sheet's modal has been removed from the screen. */
export function notifyChoiceSheetClosed(): void {
  useChoiceSheetStore.setState({ sheetOpen: false });
  setTimeout(() => {
    for (const done of [...closeWaiters]) done();
  }, SHEET_CLOSED_SETTLE_MS);
}

function waitForChoiceSheetClosed(): Promise<void> {
  if (!useChoiceSheetStore.getState().sheetOpen) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(fallback);
      closeWaiters.delete(done);
      resolve();
    };
    const fallback = setTimeout(done, SHEET_CLOSED_FALLBACK_MS);
    closeWaiters.add(done);
  });
}

/**
 * Asks the diner to pick one of a few options in the app's own bottom sheet, in place of the
 * system alert. Resolves with the option's id, or null when the sheet is dismissed. A question
 * still open when another is asked is answered "dismissed", so nothing is left waiting.
 *
 * The answer arrives only once the sheet has left the screen: a photo picker or camera opened
 * the moment the sheet is tapped would be refused by iOS while the sheet's modal is still up.
 */
export async function askChoice(input: {
  title: string;
  message?: string;
  options: readonly ChoiceOption[];
}): Promise<string | null> {
  useChoiceSheetStore.getState().settle(null);
  const choice = await new Promise<string | null>((resolve) => {
    useChoiceSheetStore.setState({ request: { ...input, resolve }, sheetOpen: true });
  });
  await waitForChoiceSheetClosed();
  return choice;
}
