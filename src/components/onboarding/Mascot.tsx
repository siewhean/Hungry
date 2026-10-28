import { MascotGraphicV2 } from "@/components/icons/food/MascotGraphicV2";
import { AccessibleImage } from "@/components/ui";
import {
  MASCOT_POSE_IMAGES,
  PLACEHOLDER_EXPRESSION,
  type MascotPose,
} from "@/features/onboarding/mascot";

/** The mascot in one pose. Draws the pose picture when it exists, the placeholder bowl otherwise. */
export function Mascot({ pose, size = 64 }: { pose: MascotPose; size?: number }) {
  const image = MASCOT_POSE_IMAGES[pose];
  if (image) {
    return (
      <AccessibleImage
        decorative
        contentFit="contain"
        source={image}
        style={{ height: size, width: size }}
      />
    );
  }
  return <MascotGraphicV2 size={size} expression={PLACEHOLDER_EXPRESSION[pose]} />;
}
