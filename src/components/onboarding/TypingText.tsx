import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui";
import { startTypewriter, type Typewriter } from "@/features/onboarding/typewriter";
import { hasTypedLine, markTypedLine } from "@/features/onboarding/typedLines";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { selectHaptic } from "@/lib/haptics";

type Props = {
  /** Names the line, so it types in only the first time the screen is seen. */
  lineId: string;
  text: string;
  variant?: "h1" | "h2" | "body";
  tone?: "secondary";
};

/**
 * The mascot's line, typed in letter by letter with a light tick for each letter. Tap to show it all.
 * Screen readers get the whole line from the start; Reduce Motion and a screen seen before show it at
 * once with no ticks.
 */
export function TypingText({ lineId, text, variant = "h2", tone }: Props) {
  const reduceMotion = useReduceMotion();
  const [visible, setVisible] = useState("");
  const typewriterRef = useRef<Typewriter | null>(null);

  useEffect(() => {
    const instant = reduceMotion || hasTypedLine(lineId);
    const typewriter = startTypewriter({
      text,
      instant,
      onProgress: (shown, done) => {
        setVisible(shown);
        if (done) markTypedLine(lineId);
      },
      onTick: selectHaptic,
    });
    typewriterRef.current = typewriter;
    return () => typewriter.cancel();
  }, [lineId, text, reduceMotion]);

  return (
    <Pressable
      accessible
      accessibilityRole="header"
      accessibilityLabel={text}
      onPress={() => typewriterRef.current?.finish()}
    >
      {/* Both texts are hidden from a screen reader: the label above has the full line. The first one
          holds the room the whole line needs, so the layout does not jump while letters appear. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <AppText variant={variant} tone={tone} style={{ opacity: 0 }}>
          {text}
        </AppText>
        <AppText
          variant={variant}
          tone={tone}
          style={{ left: 0, position: "absolute", right: 0, top: 0 }}
        >
          {visible}
        </AppText>
      </View>
    </Pressable>
  );
}
