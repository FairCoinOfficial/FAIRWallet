/**
 * ListItem — universal list row for settings, contacts, coin control, etc.
 * Supports icon, title/subtitle, value, chevron, and custom trailing content.
 */

import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface ListItemProps {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
  showChevron?: boolean;
  isLast?: boolean;
}

export function ListItem({
  title,
  subtitle,
  value,
  icon,
  iconColor = "#9ffb50",
  iconBg = "bg-fair-green/10",
  onPress,
  trailing,
  destructive = false,
  showChevron,
  isLast = false,
}: ListItemProps) {
  const shouldShowChevron = showChevron ?? (onPress !== undefined);

  const titleColor = useMemo(() => {
    if (destructive) return "text-red-400";
    return "text-white";
  }, [destructive]);

  const borderClass = isLast ? "" : "border-b border-fair-border";

  const content = (
    <View className={`flex-row items-center px-4 py-3.5 ${borderClass}`}>
      {/* Left: icon */}
      {icon ? (
        <View
          className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${iconBg}`}
        >
          <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}

      {/* Center: title + subtitle */}
      <View className="flex-1 mr-3">
        <Text className={`text-sm font-medium ${titleColor}`} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-fair-muted text-xs mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right: value + trailing + chevron */}
      {value ? (
        <Text className="text-fair-muted text-sm mr-2">{value}</Text>
      ) : null}
      {trailing}
      {shouldShowChevron ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color="#6b7280"
        />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:bg-fair-dark/50">
        {content}
      </Pressable>
    );
  }

  return content;
}
