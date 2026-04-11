/**
 * Onboarding stack layout.
 * Dark theme with green back button, transparent headers.
 */

import { useMemo } from "react";
import { Stack } from "expo-router";
import { useColorScheme } from "../../src/theme/useColorScheme";

export default function OnboardingLayout() {
  const { colors } = useColorScheme();

  const screenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: "transparent" },
      headerTintColor: colors.primary,
      headerTitleStyle: { color: colors.foreground },
      headerTransparent: true,
      contentStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
    }),
    [colors],
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="welcome"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="create"
        options={{ title: "" }}
      />
      <Stack.Screen
        name="restore"
        options={{ title: "" }}
      />
      <Stack.Screen
        name="pin-setup"
        options={{ title: "", headerBackVisible: false }}
      />
    </Stack>
  );
}
