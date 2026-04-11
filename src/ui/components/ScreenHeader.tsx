/**
 * ScreenHeader — common header layout with centered title and side actions.
 */

import { View, Text } from "react-native";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
}: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center px-4 py-3">
      {/* Left action slot */}
      <View className="w-12 items-start">
        {leftAction ?? null}
      </View>

      {/* Center: title + subtitle */}
      <View className="flex-1 items-center">
        <Text className="text-white text-lg font-semibold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right action slot */}
      <View className="w-12 items-end">
        {rightAction ?? null}
      </View>
    </View>
  );
}
