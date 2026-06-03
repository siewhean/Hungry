import { Search, X } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { IconButton } from "./IconButton";
import { Input } from "./Input";

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
      leftIcon={<Search size={20} color={palette.textMuted} />}
      rightIcon={
        value.trim() ? (
          <IconButton
            accessibilityLabel="Clear search"
            variant="ghost"
            icon={<X size={18} color={palette.textMuted} />}
            onPress={() => onChangeText("")}
          />
        ) : undefined
      }
    />
  );
}
