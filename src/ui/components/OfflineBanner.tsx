import { View, Text } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "@oxyhq/bloom/theme";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

export function OfflineBanner() {
  const { isInternetReachable } = useNetworkStatus();
  const theme = useTheme();

  if (isInternetReachable) return null;

  return (
    <View className="bg-destructive/90 flex-row items-center justify-center py-2 px-4">
      <MaterialCommunityIcons
        name="wifi-off"
        size={14}
        color={theme.colors.text}
      />
      <Text className="text-foreground text-xs font-medium ml-1.5">
        No internet connection
      </Text>
    </View>
  );
}
