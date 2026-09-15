/**
 * Tab layout — one tab navigator for iOS, Android, web and Electron.
 *
 * The bar is Bloom, rendered through the navigator's `tabBar` slot:
 *
 *   - a wide browser window  -> Bloom `Rail`, beside the screens
 *                               (`tabBarPosition: "left"`)
 *   - everything else        -> Bloom's floating `TabBar` pill
 *
 * It replaced two layouts: native `NativeTabs` (the platform's own bar) and a
 * hand-built headless-tabs rail/bottom-list for web. The destinations, their
 * order and their labels come from `src/ui/navigation/tabs.tsx`, so rail and
 * bar cannot disagree.
 *
 * The bar FLOATS over the screens. A tab screen keeps its last row clear of it
 * with `useTabScreenBottomInset()`.
 *
 * `TabBarMinimizeProvider` wraps the navigator rather than sitting inside it:
 * it has to be an ancestor of both the screens that could drive the minimize
 * signal and the bar that reads it.
 */

import { Tabs } from "expo-router/tabs";
import { TabBarMinimizeProvider } from "@oxy.so/bloom/tab-bar";
import { useTheme } from "@oxy.so/bloom/theme";
import { WalletRail } from "../../src/ui/navigation/WalletRail";
import { WalletTabBar } from "../../src/ui/navigation/WalletTabBar";
import { WALLET_TABS, useWalletNavLayout } from "../../src/ui/navigation/tabs";

export default function TabLayout() {
  const theme = useTheme();
  const layout = useWalletNavLayout();
  const tabs = WALLET_TABS;

  return (
    <TabBarMinimizeProvider>
      <Tabs
        tabBar={(props) =>
          layout === "rail" ? <WalletRail {...props} tabs={tabs} /> : <WalletTabBar {...props} tabs={tabs} />
        }
        screenOptions={{
          headerShown: false,
          tabBarPosition: layout === "rail" ? "left" : "bottom",
          sceneStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="map" />
        <Tabs.Screen name="send" />
        <Tabs.Screen name="receive" />
        <Tabs.Screen name="buy" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </TabBarMinimizeProvider>
  );
}
