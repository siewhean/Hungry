import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { PostComposerScreen } from "./PostComposerScreen";
/** The developer variant uses the supported food-first composer and durable drafts. */
export function PostComposerScreenV2(
  props: NativeStackScreenProps<RootStackParamList, "PostComposerV2">,
) {
  return <PostComposerScreen {...props} />;
}
