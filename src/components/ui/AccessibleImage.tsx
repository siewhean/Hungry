import { Image, type ImageProps } from "expo-image";

type SharedAccessibleImageProps = Omit<
  ImageProps,
  | "accessible"
  | "accessibilityElementsHidden"
  | "accessibilityHint"
  | "accessibilityLabel"
  | "accessibilityRole"
  | "importantForAccessibility"
>;

type MeaningfulImageProps = SharedAccessibleImageProps & {
  accessibilityLabel: string;
  accessibilityHint?: string;
  decorative?: false;
};

type DecorativeImageProps = SharedAccessibleImageProps & {
  decorative: true;
  accessibilityLabel?: never;
  accessibilityHint?: never;
};

export type AccessibleImageProps = MeaningfulImageProps | DecorativeImageProps;

/**
 * Accessibility contract:
 * - Meaningful images must provide a specific `accessibilityLabel`.
 * - Decorative images must set `decorative` so screen readers skip repeated visual texture.
 * - Do not pass raw `expo-image` renders from production UI unless a source contract excludes it.
 */
export function AccessibleImage(props: AccessibleImageProps) {
  if (props.decorative) {
    const { decorative: _decorative, ...imageProps } = props;
    return (
      <Image
        {...imageProps}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  }

  const { decorative: _decorative, accessibilityLabel, accessibilityHint, ...imageProps } = props;
  return (
    <Image
      {...imageProps}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="image"
    />
  );
}
