import { Alert, Platform } from "react-native";

type Options = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export async function confirmGalleryAccess({
  title,
  message,
  confirmLabel = "Allow",
  cancelLabel = "Not now",
}: Options): Promise<boolean> {
  if (Platform.OS === "web") {
    return true;
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: cancelLabel,
          style: "cancel",
          onPress: () => {
            resolve(false);
          },
        },
        {
          text: confirmLabel,
          onPress: () => {
            resolve(true);
          },
        },
      ],
      // Android back/outside tap dismisses without a button; treat it as "Not now".
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function isGalleryPermissionGranted(permission: {
  granted?: boolean;
  status?: string;
}): boolean {
  return (
    Boolean(permission.granted) ||
    permission.status === "granted" ||
    permission.status === "limited"
  );
}
