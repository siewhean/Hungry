import { Image, type ImageProps } from "expo-image";

import { HUNGRY_LOGO_ICON } from "@/constants/brandAssets";
import { stableCacheKeyForUri } from "@/lib/images/stableCacheKey";

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

/** A signed storage URL gets a cacheKey that survives re-signing (see stableCacheKey). */
function withStableCacheKey(source: ImageProps["source"]): ImageProps["source"] {
  if (!source || typeof source !== "object" || Array.isArray(source) || !("uri" in source)) {
    return source;
  }
  if (source.cacheKey) return source;
  const cacheKey = stableCacheKeyForUri(source.uri);
  return cacheKey ? { ...source, cacheKey } : source;
}

/**
 * Accessibility contract:
 * - Meaningful images must provide a specific `accessibilityLabel`.
 * - Decorative images must set `decorative` so screen readers skip repeated visual texture.
 * - Do not pass raw `expo-image` renders from production UI unless a source contract excludes it.
 */
export function AccessibleImage(props: AccessibleImageProps) {
  const resolvedSource = withStableCacheKey(
    props.source &&
      typeof props.source === "object" &&
      "uri" in props.source &&
      props.source.uri ===
        "https://raw.githubusercontent.com/siewhean/Hungry/main/assets/images/Logo/hungry_logo_icon_transparent.png"
      ? HUNGRY_LOGO_ICON
      : props.source,
  );

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
