import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { ArrowLeft, Search as SearchIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, ChipGroup, IconButton, Input, Screen } from "@/components/ui";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { SearchCategory } from "@/types/domain";

// The paged catalog request maps only these categories into a cuisine filter,
// so other chips would do nothing.
const CATALOG_CATEGORIES: SearchCategory[] = ["noodles", "rice"];
const CATEGORY_OPTIONS = CATALOG_CATEGORIES.map((category) => ({
  id: category,
  label: category.replace(/\b\w/g, (char) => char.toUpperCase()),
}));
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function DishSearchScreen() {
  const navigation = useNavigation<RootNavigation>();
  const { motion, palette, spacing } = useHungryTheme();
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const toggleCategory = useSearchStore((state) => state.toggleCategory);
  const [searchText, setSearchText] = useState("");
  // Search results own the paged catalog request; this landing screen stays
  // free of local recommendations so it never hydrates the whole catalog.
  const entryY = useRef(new Animated.Value(-28)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const trimmedSearchText = searchText.trim();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0,
        duration: motion.screenTransition,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: motion.screenTransition,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [entryOpacity, entryY, motion.screenTransition]);

  return (
    <Screen>
      <Animated.View
        style={{
          gap: spacing[4],
          opacity: entryOpacity,
          transform: [{ translateY: entryY }],
        }}
      >
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[3],
          }}
        >
          <IconButton
            variant="ghost"
            accessibilityLabel="Go back"
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              navigation.navigate("MainTabs", { screen: "Discover" });
            }}
            icon={<ArrowLeft color={palette.text} size={18} />}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="h1">Search</AppText>
          </View>
        </View>

        <Input
          leftIcon={<SearchIcon color={palette.textMuted} size={18} />}
          placeholder="Laksa, satay, Tian Tian..."
          accessibilityLabel="Search dishes, stalls, or hawker centres"
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            updateQuery(text);
          }}
          onSubmitEditing={() => {
            const trimmedQuery = searchText.trim();
            if (trimmedQuery) {
              rememberSearch(trimmedQuery);
            }
            navigation.navigate("SearchResults");
          }}
        />
        <ChipGroup
          options={CATEGORY_OPTIONS}
          selectedIds={selectedCategories}
          onSelect={toggleCategory}
        />
        <Button
          label={trimmedSearchText ? "See all results" : "View search results"}
          onPress={() => {
            if (trimmedSearchText) {
              rememberSearch(trimmedSearchText);
            }
            navigation.navigate("SearchResults");
          }}
        />
      </Animated.View>
    </Screen>
  );
}
