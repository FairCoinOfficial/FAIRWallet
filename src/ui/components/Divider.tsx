/**
 * Divider — simple horizontal line separator.
 */

import { View } from "react-native";

interface DividerProps {
  className?: string;
}

export function Divider({ className = "" }: DividerProps) {
  return <View className={`h-px bg-fair-border ${className}`.trim()} />;
}
