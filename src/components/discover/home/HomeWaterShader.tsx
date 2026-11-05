import { useMemo } from "react";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

/**
 * Water for the top of Home, drawn by a GPU shader. Skia runs it through Metal on iPhone (the
 * SkSL below is compiled to Metal Shading Language) and through GL or Vulkan on Android.
 *
 * Three layers, all driven by one slow clock:
 *  - two long swells hanging from the top, a pale one behind a deeper one, each with a rolling edge;
 *  - a pale foam line along the front swell;
 *  - wide, soft caustics (the net of light that moves over a pool floor) and a depth gradient.
 * The tint is the theme orange and the strength is low, so the header text stays readable.
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

  // Two long swells, one behind the other: the back one is paler and sits lower.
  float front = 0.78 + 0.05 * sin(uv.x * 3.0 + t * 0.8) + 0.025 * sin(uv.x * 5.5 - t * 0.6 + 1.3);
  float back = 0.90 + 0.04 * sin(uv.x * 2.4 - t * 0.5 + 2.0) + 0.02 * sin(uv.x * 4.6 + t * 0.7);
  float inFront = 1.0 - smoothstep(front - 0.01, front + 0.01, uv.y);
  float inBack = 1.0 - smoothstep(back - 0.01, back + 0.01, uv.y);
  float foam = smoothstep(0.022, 0.0, abs(uv.y - front)) * inFront;

  // Wide, soft caustics (a quarter of the old detail), drifting slowly.
  float2 q = float2(uv.x * aspect, uv.y) * 0.55;
  float light = caustic(q + float2(t * 0.02, 0.0), t * 0.45)
              + 0.5 * caustic(q * 1.4 - float2(0.0, t * 0.02), t * 0.3 + 3.0);
  light = clamp(light, 0.0, 1.0);

  // Deep water is the tint, shallow water is almost clear: darker toward each swell's edge.
  float3 deep = tint;
  float3 shallow = mix(tint, float3(1.0, 0.8, 0.5), 0.3);
  float depth = smoothstep(0.1, front, uv.y);
  float3 frontRgb = mix(shallow, deep, depth);
  frontRgb = mix(frontRgb, float3(1.0), clamp(light * 0.55 + foam * 0.7, 0.0, 1.0));
  float frontA = inFront * strength * (0.5 + 0.5 * depth);

  float3 backRgb = mix(shallow, tint, 0.5);
  float backA = inBack * strength * 0.55;

  // The front swell over the back one.
  float a = frontA + backA * (1.0 - frontA);
  float3 rgb = (frontRgb * frontA + backRgb * backA * (1.0 - frontA)) / max(a, 0.0001);
  a = clamp(a * (1.0 + light * 0.35 + foam * 0.5), 0.0, 1.0);
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
