import React, { useCallback, useRef, useState } from "react";

import { Dialog } from "@/components/ui";

export interface MerchantDialogButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export type ShowMerchantAlert = (
  title: string,
  message?: string,
  buttons?: MerchantDialogButton[],
) => void;

interface PendingDialog {
  title: string;
  message?: string;
  buttons: MerchantDialogButton[];
}

/**
 * `Alert.alert` with the same arguments, drawn with the shared Dialog. React Native's Alert does
 * nothing on web, which silently blocked confirmations and error messages in the Merchant Centre.
 * Render the returned `dialog` once in the screen (or in its own modal, when shown from a Modal).
 */
export function useMerchantDialog() {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  // Dialog runs a button's handler and then onClose; a handler that opens a new dialog must
  // survive that close.
  const buttonJustPressed = useRef(false);

  const showAlert = useCallback<ShowMerchantAlert>((title, message, buttons) => {
    const source = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
    setPending({
      title,
      message,
      buttons: source.map((button) => ({
        ...button,
        onPress: () => {
          buttonJustPressed.current = true;
          setPending(null);
          button.onPress?.();
        },
      })),
    });
  }, []);

  const close = useCallback(() => {
    if (buttonJustPressed.current) {
      buttonJustPressed.current = false;
      return;
    }
    setPending(null);
  }, []);

  const dialog = (
    <Dialog
      visible={pending !== null}
      title={pending?.title ?? ""}
      message={pending?.message}
      buttons={pending?.buttons ?? []}
      onClose={close}
    />
  );

  return { showAlert, dialog };
}
