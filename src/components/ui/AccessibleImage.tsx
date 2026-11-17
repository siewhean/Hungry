import { Image, type ImageProps } from "expo-image";

import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";

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
  const resolvedSource =
    props.source &&
    typeof props.source === "object" &&
    "uri" in props.source &&
    props.source.uri ===
      "https://raw.githubusercontent.com/siewhean/Hungry/main/assets/images/Logo/hungry_logo_icon_transparent.png"
      ? HUNGRY_LOGO_ICON
      : props.source;

  if (props.decorative) {
    const { decorative: _decorative, source: _source, ...imageProps } = props;
    return (
      <Image
        source={resolvedSource}
        {...imageProps}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  }

  const {
    decorative: _decorative,
    accessibilityLabel,
    accessibilityHint,
    source: _source,
    ...imageProps
  } = props;
  return (
    <Image
      source={resolvedSource}
      {...imageProps}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="image"
    />
  );
}
