/**
 * Tab layout for Android and iOS using native system tab bar.
 * Uses NativeTabs from expo-router for platform-native look and feel.
 * Material symbols (md) for Android, SF Symbols (sf) for iOS.
 */

import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { NativeTabs } from "expo-router/unstable-native-tabs";

const fairDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#1b1e09",
    card: "#1b1e09",
    border: "#3a3f1e",
    primary: "#9ffb50",
    text: "#ffffff",
  },
};

export default function TabLayout() {
  return (
    <ThemeProvider value={fairDarkTheme}>
      <NativeTabs tintColor="#9ffb50">
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
