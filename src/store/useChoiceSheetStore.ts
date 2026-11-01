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
  /** Called by the host when an option is tapped (its id) or the sheet is dismissed (null). */
  settle: (choice: string | null) => void;
};

export const useChoiceSheetStore = create<ChoiceSheetState>((set, get) => ({
  request: null,
  settle: (choice) => {
    const request = get().request;
    if (!request) return;
    set({ request: null });
    request.resolve(choice);
  },
}));

/**
 * Asks the diner to pick one of a few options in the app's own bottom sheet, in place of the
 * system alert. Resolves with the option's id, or null when the sheet is dismissed. A question
 * still open when another is asked is answered "dismissed", so nothing is left waiting.
 */
export function askChoice(input: {
  title: string;
  message?: string;
  options: readonly ChoiceOption[];
}): Promise<string | null> {
  return new Promise((resolve) => {
    useChoiceSheetStore.getState().settle(null);
    useChoiceSheetStore.setState({ request: { ...input, resolve } });
  });
}
