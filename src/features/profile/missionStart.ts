import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { MissionType } from "@/types/domain";

type Navigation = Pick<NativeStackNavigationProp<RootStackParamList>, "navigate">;

/** A mission card's Start button: its words and the one place that counts towards it. */
export type MissionStart = { label: string; open: (navigation: Navigation) => void };

/** Every mission type leads somewhere it can be done, so the Missions page is not a dead end. */
export function missionStart(type: MissionType): MissionStart {
  switch (type) {
    case "save_stalls":
      return { label: "Find stalls", open: (nav) => nav.navigate("BrowseStalls") };
    case "add_stall":
      return {
        label: "Add a stall",
        open: (nav) =>
          nav.navigate("MainTabs", { screen: "Profile", params: { screen: "AddStall" } }),
      };
    case "create_post":
      return { label: "Add a dish", open: (nav) => nav.navigate("Post") };
    case "write_review":
      return {
        label: "Write a review",
        open: (nav) => nav.navigate("ReviewStack", { screen: "ReviewMain" }),
      };
    case "mark_tried":
      return { label: "Find a dish", open: (nav) => nav.navigate("SearchHome") };
    case "add_to_collection":
      return { label: "Open Saved", open: (nav) => nav.navigate("Favourites") };
    case "helpful_vote":
      return {
        label: "Read reviews",
        open: (nav) => nav.navigate("MainTabs", { screen: "Review" }),
      };
  }
}
