/**
 * Tab layout for Android and iOS using native system tab bar.
 * Dynamically applies dark or light theme from Bloom preset.
 */

import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useMemo } from "react";
import { useTheme } from "@oxyhq/bloom";

export default function TabLayout() {
  const theme = useTheme();

  const navTheme = useMemo(
    () => ({
      ...(theme.isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: theme.colors.background,
        card: theme.colors.card,
        border: theme.colors.border,
        primary: theme.colors.primary,
        text: theme.colors.text,
      },
    }),
    [theme],
  );

  return (
    <ThemeProvider value={navTheme}>
      <NativeTabs tintColor={theme.colors.primary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon
            sf={{ default: "creditcard", selected: "creditcard.fill" }}
            md="wallet"
          />
          <NativeTabs.Trigger.Label>Wallet</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="send">
          <NativeTabs.Trigger.Icon
            sf={{ default: "arrow.up.circle", selected: "arrow.up.circle.fill" }}
            md="arrow_upward"
          />
          <NativeTabs.Trigger.Label>Send</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="receive">
          <NativeTabs.Trigger.Icon
            sf={{ default: "arrow.down.circle", selected: "arrow.down.circle.fill" }}
            md="arrow_downward"
          />
          <NativeTabs.Trigger.Label>Receive</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon
            sf={{ default: "gearshape", selected: "gearshape.fill" }}
            md="settings"
          />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
