/**
 * Tab layout for Web (Electron desktop).
 * Uses headless tabs from expo-router/ui with custom styling.
 * NativeTabs is not available on web, so we use the JS-based approach.
 * Tab labels use the i18n system for translation.
 */

import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { View, Text, StyleSheet } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { t } from "../../src/i18n";
import { useTheme } from "@oxyhq/bloom";

interface WebTabProps {
  name: string;
  href: React.ComponentProps<typeof TabTrigger>["href"];
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  tintColor: string;
}

function WebTab({ name, href, icon, label, tintColor }: WebTabProps) {
  return (
    <TabTrigger name={name} href={href} style={styles.tab}>
      <MaterialCommunityIcons name={icon} size={22} color={tintColor} />
      <Text style={[styles.tabLabel, { color: tintColor }]}>{label}</Text>
    </TabTrigger>
  );
}

export default function TabLayout() {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Tabs>
        <View style={styles.content}>
          <TabSlot />
        </View>
        <TabList
          style={[
            styles.tabList,
            {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <WebTab name="index" href="/(tabs)" icon="wallet" label={t("wallet.title")} tintColor={theme.colors.primary} />
          <WebTab name="send" href="/(tabs)/send" icon="arrow-up-bold" label={t("wallet.send")} tintColor={theme.colors.primary} />
          <WebTab name="receive" href="/(tabs)/receive" icon="arrow-down-bold" label={t("wallet.receive")} tintColor={theme.colors.primary} />
          <WebTab name="settings" href="/(tabs)/settings" icon="cog" label={t("wallet.settings")} tintColor={theme.colors.primary} />
        </TabList>
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabList: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
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
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
});
