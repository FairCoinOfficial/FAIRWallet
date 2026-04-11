/**
 * Onboarding stack layout.
 * Dark theme with green back button, transparent headers.
 */

import { Stack } from "expo-router";

const SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: "transparent" },
  headerTintColor: "#9ffb50",
  headerTitleStyle: { color: "#ffffff" },
  headerTransparent: true,
  contentStyle: { backgroundColor: "#1b1e09" },
  headerShadowVisible: false,
} as const;

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={SCREEN_OPTIONS}>
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
