/**
 * Peers group layout — Stack navigator for peers list + add peer subscreen.
 */

import { Stack } from "expo-router";
import { useTheme } from "@oxyhq/bloom/theme";

export default function PeersLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.tint,
        headerTitleStyle: { color: theme.colors.text },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Network Peers" }}
      />
      <Stack.Screen
        name="add"
        options={{ title: "Add Peer" }}
      />
    </Stack>
  );
}
