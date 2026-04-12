/**
 * Tab layout for Web (Electron desktop).
 * Uses headless tabs from expo-router/ui with custom styling.
 * NativeTabs is not available on web, so we use the JS-based approach.
 * Tab labels use the i18n system for translation.
 *
 * Responsive: on narrow screens (< 768px) the tab bar sits at the bottom as a
 * row. On wide screens (>= 768px) it becomes a vertical sidebar on the left,
 * suitable for tablets, desktop browsers, and the Electron shell.
 *
 * IMPORTANT: `TabTrigger` must appear as a direct child of `TabList`. Wrapping
 * them in helper components breaks expo-router's child parser, which looks up
 * triggers by React element type, not by the rendered output.
 */

import { Tabs, TabList, TabTrigger, TabSlot } from "expo-router/ui";
import { usePathname } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { t } from "../../src/i18n";
import { useTheme } from "@oxyhq/bloom/theme";
import { FONT_PHUDU_BLACK } from "../../src/utils/fonts";

const WIDE_BREAKPOINT = 768;
const SIDEBAR_WIDTH = 240;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

type TabDef = {
  name: string;
  href: "/" | "/send" | "/receive" | "/settings";
  icon: IconName;
  label: string;
};

function isIndexActive(pathname: string): boolean {
  return pathname === "/" || pathname === "/(tabs)" || pathname === "";
}

function isActiveTab(pathname: string, href: TabDef["href"]): boolean {
  if (href === "/") {
    return isIndexActive(pathname);
  }
  return pathname === href;
}

export default function TabLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const pathname = usePathname();

  const tabs: readonly TabDef[] = [
    { name: "index", href: "/", icon: "wallet", label: t("wallet.title") },
    { name: "send", href: "/send", icon: "arrow-up-bold", label: t("wallet.send") },
    {
      name: "receive",
      href: "/receive",
      icon: "arrow-down-bold",
      label: t("wallet.receive"),
    },
    {
      name: "settings",
      href: "/settings",
      icon: "cog",
      label: t("wallet.settings"),
    },
  ];

  const renderTrigger = (tab: TabDef) => {
    const active = isActiveTab(pathname, tab.href);
    const color = active ? theme.colors.primary : theme.colors.textSecondary;

    const triggerStyle: StyleProp<ViewStyle> = isWide
      ? [
          styles.sidebarTab,
          active && {
            backgroundColor: `${theme.colors.primary}1A`,
          },
        ]
      : styles.bottomTab;

    const labelStyle: StyleProp<TextStyle> = isWide
      ? [styles.sidebarLabel, { color }]
      : [styles.bottomLabel, { color }];

    return (
      <TabTrigger key={tab.name} name={tab.name} href={tab.href} style={triggerStyle}>
        <MaterialCommunityIcons name={tab.icon} size={22} color={color} />
        <Text style={labelStyle}>{tab.label}</Text>
      </TabTrigger>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
        isWide && styles.containerWide,
      ]}
    >
      <Tabs>
        {isWide ? (
          <>
            <TabList
              style={[
                styles.sidebar,
                {
                  backgroundColor: theme.colors.background,
                  borderRightColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.brand}>
                <Text
                  style={[styles.brandText, { color: theme.colors.primary }]}
                  numberOfLines={1}
                >
                  FAIRWallet
                </Text>
              </View>
              {tabs.map(renderTrigger)}
            </TabList>
            <TabSlot />
          </>
        ) : (
          <>
            <TabSlot />
            <TabList
              style={[
                styles.bottomList,
                {
                  backgroundColor: theme.colors.background,
                  borderTopColor: theme.colors.border,
                },
              ]}
            >
              {tabs.map(renderTrigger)}
            </TabList>
          </>
        )}
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerWide: {
    flexDirection: "row",
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
    borderRightWidth: 1,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 4,
  },
  brand: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  brandText: {
    fontFamily: FONT_PHUDU_BLACK,
    fontSize: 24,
    letterSpacing: 0.5,
  },
  sidebarTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 14,
  },
  sidebarLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  bottomList: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  bottomTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  bottomLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
});
