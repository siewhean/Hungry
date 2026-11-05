import { useMemo } from "react";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

/**
 * Water for the top of Home, drawn by a GPU shader. Skia runs it through Metal on iPhone (the
 * SkSL below is compiled to Metal Shading Language) and through GL or Vulkan on Android.
 *
 * Three layers, all driven by one clock:
 *  - a band hanging from the top whose lower edge is a rolling wave, with a pale foam line on it;
 *  - caustics, the bright net of light that moves over a pool floor;
 *  - a soft depth gradient so the water is deeper (more tinted) toward the edge.
 * The tint is the brand orange and the strength is low, so the header text stays readable.
 */
export const WATER_SHADER_SOURCE = `
uniform float2 size;
uniform float time;
uniform float3 tint;
uniform float strength;

float caustic(float2 uv, float t) {
  float2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  float2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + float2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(float2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

half4 main(float2 xy) {
  float2 uv = xy / size;
  float aspect = size.x / size.y;

  // The rolling lower edge of the band.
  float edge = 0.84 + 0.04 * sin(uv.x * 7.0 + time * 0.9) + 0.025 * sin(uv.x * 13.0 - time * 1.3);
  float inside = 1.0 - smoothstep(edge - 0.012, edge + 0.012, uv.y);
  float foam = smoothstep(0.03, 0.0, abs(uv.y - edge)) * inside;

  // Light on the water: two caustic layers drifting in different directions.
  float2 q = float2(uv.x * aspect, uv.y) * 0.9;
  float light = caustic(q + float2(time * 0.012, 0.0), time * 0.5)
              + 0.6 * caustic(q * 1.7 - float2(0.0, time * 0.015), time * 0.35 + 3.0);
  light = clamp(light, 0.0, 1.0);

  // Deeper (more tinted) toward the edge, clearer at the top.
  float depth = smoothstep(0.0, edge, uv.y);
  float alpha = inside * strength * (0.45 + 0.55 * depth);
  float3 rgb = mix(tint, float3(1.0), clamp(light * 0.75 + foam * 0.6, 0.0, 1.0));
  float a = clamp(alpha * (1.0 + light * 0.9 + foam * 0.8), 0.0, 1.0);
  return half4(half3(rgb * a), half(a));
}
`;

type Props = {
  width: number;
  height: number;
  /** Seconds, ever increasing; the surface moves as it grows. */
  time: SharedValue<number>;
  /** The brand colour the water is tinted with, as a CSS colour. */
  color: string;
  /** How visible the water is, 0 to 1. */
  strength: number;
};

export function HomeWaterShader({ width, height, time, color, strength }: Props) {
  const effect = useMemo(() => Skia.RuntimeEffect.Make(WATER_SHADER_SOURCE), []);
  const tint = useMemo(() => {
    const rgba = Skia.Color(color);
    return [rgba[0], rgba[1], rgba[2]];
  }, [color]);
  const uniforms = useDerivedValue(
    () => ({ size: [width, height], time: time.value, tint, strength }),
    [width, height, tint, strength],
  );
  if (!effect) return null;
  return (
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
