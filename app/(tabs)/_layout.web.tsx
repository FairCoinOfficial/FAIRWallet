/**
 * Tab layout for Web (Electron desktop).
 * Uses headless tabs from expo-router/ui with custom styling.
 * NativeTabs is not available on web, so we use the JS-based approach.
 */

import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { View, Text, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface WebTabProps {
  name: string;
  href: React.ComponentProps<typeof TabTrigger>["href"];
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
}

function WebTab({ name, href, icon, label }: WebTabProps) {
  return (
    <TabTrigger name={name} href={href} style={styles.tab}>
      <MaterialCommunityIcons name={icon} size={22} color="#9ffb50" />
      <Text style={styles.tabLabel}>{label}</Text>
    </TabTrigger>
  );
}

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <Tabs>
        <View style={styles.content}>
          <TabSlot />
        </View>
        <TabList style={styles.tabList}>
          <WebTab name="index" href="/(tabs)" icon="wallet" label="Wallet" />
          <WebTab name="send" href="/(tabs)/send" icon="arrow-up-bold" label="Send" />
          <WebTab name="receive" href="/(tabs)/receive" icon="arrow-down-bold" label="Receive" />
          <WebTab name="settings" href="/(tabs)/settings" icon="cog" label="Settings" />
        </TabList>
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1b1e09",
  },
  content: {
    flex: 1,
  },
  tabList: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#1b1e09",
    borderTopWidth: 1,
    borderTopColor: "#3a3f1e",
    paddingVertical: 8,
    paddingBottom: 12,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  tabLabel: {
    color: "#9ffb50",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
});
