/**
 * Onboarding stack layout.
 * Transparent headers with green back button.
 */

import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "transparent" },
        headerTintColor: "#9ffb50",
        headerTitleStyle: { color: "#ffffff" },
        headerTransparent: true,
        contentStyle: { backgroundColor: "#1b1e09" },
      }}
    >
      <Stack.Screen
        name="welcome"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="create"
        options={{ title: "Create Wallet" }}
      />
      <Stack.Screen
        name="restore"
        options={{ title: "Restore Wallet" }}
      />
      <Stack.Screen
        name="pin-setup"
        options={{ title: "Set PIN", headerBackVisible: false }}
      />
    </Stack>
  );
}
