import { View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

type Props = {
  size: number;
  color: string;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * The halal mark in one colour: the Arabic word for halal inside a ring. It takes the colour it
 * is given, so it fits the theme in light and dark. It marks a dish as tagged halal; it is not
 * the MUIS certification logo and never stands for certification.
 */
export function HalalMark({ size, color, accessibilityLabel, testID }: Props) {
  const labelled = Boolean(accessibilityLabel);
  return (
    <View
      testID={testID}
      accessible={labelled}
      accessibilityRole={labelled ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!labelled}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={10.5} stroke={color} strokeWidth={1.5} fill="none" />
        <SvgText x={12} y={16} fill={color} fontSize={11} fontWeight="700" textAnchor="middle">
          حلال
        </SvgText>
      </Svg>
    </View>
  );
}
