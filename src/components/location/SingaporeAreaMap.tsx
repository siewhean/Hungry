import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import {
  SINGAPORE_MAP_HEIGHT,
  SINGAPORE_MAP_WIDTH,
  SINGAPORE_PLANNING_AREAS,
  projectCoordinate,
  ringsToPath,
} from "@/features/location/singaporeAreaMap";
import { useHungryTheme } from "@/theme";
import type { Coordinate } from "@/types/domain";

type Props = {
  width: number;
  /** Planning areas drawn in orange (see planningAreasFor). */
  highlighted?: readonly string[];
  /** A dropped pin for a chosen place. */
  pin?: Coordinate;
};

const AREA_PATHS = SINGAPORE_PLANNING_AREAS.map((area) => ({
  name: area.name,
  d: ringsToPath(area.rings),
}));

/** Singapore split into its planning areas, with the chosen area filled and a pin for a place. */
export function SingaporeAreaMap({ width, highlighted = [], pin }: Props) {
  const { palette } = useHungryTheme();
  const height = (width * SINGAPORE_MAP_HEIGHT) / SINGAPORE_MAP_WIDTH;
  const lit = useMemo(() => new Set(highlighted), [highlighted]);
  const pinPoint = pin ? projectCoordinate(pin) : undefined;
  const label = highlighted.length
    ? `Map of Singapore with ${highlighted.join(", ")} highlighted`
    : "Map of Singapore by area";

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${SINGAPORE_MAP_WIDTH} ${SINGAPORE_MAP_HEIGHT}`}
      >
        <G>
          {AREA_PATHS.map((area) => (
            <Path
              key={area.name}
              d={area.d}
              fill={lit.has(area.name) ? palette.orange : palette.bgSoft}
              fillOpacity={lit.has(area.name) ? 0.85 : 1}
              stroke={lit.has(area.name) ? palette.orange : palette.textMuted}
              strokeOpacity={lit.has(area.name) ? 1 : 0.35}
              strokeWidth={lit.has(area.name) ? 3 : 1.5}
              strokeLinejoin="round"
            />
          ))}
        </G>
        {pinPoint ? (
          <G>
            <Circle cx={pinPoint.x} cy={pinPoint.y} r={26} fill={palette.orange} opacity={0.2} />
            <Path
              d={`M${pinPoint.x} ${pinPoint.y}c-6-16-20-24-20-38a20 20 0 1 1 40 0c0 14-14 22-20 38z`}
              fill={palette.orange}
              stroke={palette.surface}
              strokeWidth={3}
            />
            <Circle cx={pinPoint.x} cy={pinPoint.y - 38} r={7} fill={palette.surface} />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}
