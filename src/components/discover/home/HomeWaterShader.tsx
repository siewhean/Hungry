import { useMemo } from "react";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

/**
 * Water for the top of Home, drawn by a GPU shader. Skia runs it through Metal on iPhone (the
 * SkSL below is compiled to Metal Shading Language) and through GL or Vulkan on Android.
 *
 * Three parts, all driven by one slow clock:
 *  - one long swell hanging from the top, with a rolling edge and a pale foam line along it;
 *  - wide, soft caustics (the net of light that moves over a pool floor);
 *  - a gradient from a brighter orange at the top to the full theme orange at the edge.
 * The orange is the theme orange, almost opaque so it stays vivid on the dark page too; the band
 * sits above the header text, not behind it.
 */
export const WATER_SHADER_SOURCE = `
uniform float2 size;
uniform float time;
uniform float3 tint;
uniform float strength;

// The bright net of light that moves over a pool floor.
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
  // Slow and calm: the whole surface runs at a third of the clock.
  float t = time * 0.3;
  float2 uv = xy / size;
  float aspect = size.x / size.y;

  // One long swell with a rolling edge.
  float front = 0.78 + 0.05 * sin(uv.x * 3.0 + t * 0.8) + 0.025 * sin(uv.x * 5.5 - t * 0.6 + 1.3);
  float inFront = 1.0 - smoothstep(front - 0.01, front + 0.01, uv.y);
  float foam = smoothstep(0.022, 0.0, abs(uv.y - front)) * inFront;

  // Wide, soft caustics (a quarter of the old detail), drifting slowly.
  float2 q = float2(uv.x * aspect, uv.y) * 0.55;
  float light = caustic(q + float2(t * 0.02, 0.0), t * 0.45)
              + 0.5 * caustic(q * 1.4 - float2(0.0, t * 0.02), t * 0.3 + 3.0);
  light = clamp(light, 0.0, 1.0);

  // Bright orange at the top, the full theme orange toward the edge, with pale light on it.
  // A little less saturated than the raw theme orange, so the water is softer.
  float luma = dot(tint, float3(0.3, 0.59, 0.11));
  float3 base = mix(float3(luma), tint, 0.82);
  float3 shallow = mix(base, float3(1.0, 0.72, 0.38), 0.3);
  float depth = smoothstep(0.1, front, uv.y);
  float3 rgb = mix(shallow, base, depth);
  rgb = mix(rgb, float3(1.0, 0.9, 0.7), clamp(light * 0.5 + foam * 0.6, 0.0, 1.0));
  float a = clamp(inFront * strength, 0.0, 1.0);
  return half4(half3(rgb * a), half(a));
}
`;

type Props = {
  width: number;
  height: number;
  /** Seconds, ever increasing; the surface moves as it grows. */
  time: SharedValue<number>;
  /** The theme orange the water is tinted with, as a CSS colour. */
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
