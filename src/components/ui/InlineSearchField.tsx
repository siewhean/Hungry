import { Search, X } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { AppSymbol } from "@/components/ui/AppSymbol";

interface InlineSearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
}

export function InlineSearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: InlineSearchFieldProps) {
  const { palette } = useHungryTheme();

  return (
    <Input
      accessibilityLabel={accessibilityLabel ?? placeholder}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      leftIcon={
        <AppSymbol name="magnifyingglass" fallback={Search} size={20} color={palette.textMuted} />
      }
      rightIcon={
        value.trim() ? (
          <IconButton
            accessibilityLabel="Clear search"
            variant="ghost"
            icon={<AppSymbol name="xmark" fallback={X} size={18} color={palette.textMuted} />}
            onPress={() => onChangeText("")}
          />
        ) : undefined
      }
    />
  );
}
