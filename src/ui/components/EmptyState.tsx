/**
 * EmptyState — placeholder for empty content areas.
 * Shows a muted icon, title, and optional subtitle centered in its container.
 */

import { View, Text } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <View className="w-16 h-16 rounded-full bg-fair-dark-light items-center justify-center mb-4">
        <MaterialCommunityIcons name={icon} size={28} color="#6b7280" />
      </View>
      <Text className="text-white text-base font-medium text-center">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-fair-muted text-sm text-center mt-1.5 max-w-[260px]">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
