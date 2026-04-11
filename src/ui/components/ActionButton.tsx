/**
 * ActionButton — circular icon button with label below.
 * Used for primary actions like Send, Receive, Stake, etc.
 */

import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
type ActionButtonSize = "sm" | "md" | "lg";

interface ActionButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: ActionButtonSize;
}

interface SizeConfig {
  circle: string;
  iconSize: number;
  textClass: string;
}

const SIZE_CONFIG: Record<ActionButtonSize, SizeConfig> = {
  sm: { circle: "w-11 h-11", iconSize: 18, textClass: "text-[10px]" },
  md: { circle: "w-14 h-14", iconSize: 22, textClass: "text-xs" },
  lg: { circle: "w-16 h-16", iconSize: 26, textClass: "text-sm" },
};

export function ActionButton({
  icon,
  label,
  onPress,
  size = "md",
}: ActionButtonProps) {
  const config = useMemo(() => SIZE_CONFIG[size], [size]);

  return (
    <Pressable onPress={onPress} className="items-center active:opacity-70">
      <View
        className={`${config.circle} rounded-full bg-fair-green/10 items-center justify-center`}
      >
        <MaterialCommunityIcons name={icon} size={config.iconSize} color="#9ffb50" />
      </View>
      <Text className={`text-fair-muted ${config.textClass} mt-1.5 font-medium`}>
        {label}
      </Text>
    </Pressable>
  );
}
