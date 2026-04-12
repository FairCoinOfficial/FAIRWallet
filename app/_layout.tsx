/**
 * Root layout for FAIRWallet.
 *
 * Theme loading strategy (same pattern as Alia):
 * 1. SplashScreen.preventAutoHideAsync() at module level
 * 2. Load persisted theme mode from async storage
 * 3. Mount BloomThemeProvider with correct mode (applies native color scheme
 *    synchronously during render via Bloom 0.1.31)
 * 4. Hide splash screen once ready
 *
 * This ensures no flash of wrong colors on native UI chrome.
 */

import "../src/crypto-polyfill";
import "../global.css";

import { useCallback, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { vars } from "nativewind";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  BloomThemeProvider,
  useBloomTheme,
  APP_COLOR_PRESETS,
} from "@oxyhq/bloom/theme";
import type { ThemeMode } from "@oxyhq/bloom/theme";
import { parseFairCoinURI } from "../src/core/uri";
import { useWalletStore } from "../src/wallet/wallet-store";
import { getAutoLockTimeout } from "../src/storage/secure-store";
import { initLanguage } from "../src/i18n";
import { getItemAsync, setItemAsync } from "../src/storage/kv-store";

// Module-level initialization (runs once before any component mounts)
initLanguage();
SplashScreen.preventAutoHideAsync();

const THEME_MODE_KEY = "fairwallet_theme_mode";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useDeepLinkHandler() {
  const router = useRouter();
  const initialized = useWalletStore((s) => s.initialized);

  const handleDeepLink = useCallback(
    (event: { url: string }) => {
      if (!event.url || !initialized) return;
      const parsed = parseFairCoinURI(event.url);
      if (parsed) {
        router.push({
          pathname: "/(tabs)/send",
          params: { address: parsed.address, amount: parsed.amount ?? "" },
        });
      }
    },
    [router, initialized],
  );

  const subscribed = useRef(false);
  if (!subscribed.current) {
    subscribed.current = true;
    Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
  }
}

function useAutoLock() {
  const router = useRouter();
  const initialized = useWalletStore((s) => s.initialized);
  const backgroundTime = useRef<number | null>(null);

  const handleStateChange = useCallback(
    (state: AppStateStatus) => {
      if (!initialized) return;
      if (state === "background" || state === "inactive") {
        backgroundTime.current = Date.now();
      } else if (state === "active" && backgroundTime.current !== null) {
        const elapsed = Date.now() - backgroundTime.current;
        backgroundTime.current = null;
        getAutoLockTimeout().then((min) => {
          if (elapsed > min * 60_000) router.replace("/lock");
        });
      }
    },
    [initialized, router],
  );

  const attached = useRef(false);
  if (!attached.current) {
    attached.current = true;
    AppState.addEventListener("change", handleStateChange);
  }
}

/**
 * Bridges Bloom preset CSS tokens into NativeWind vars().
 * This makes Tailwind classes (bg-background, text-primary, etc.)
 * resolve to the active Bloom theme colors.
 */
function useThemeVars() {
  const { theme, colorPreset } = useBloomTheme();
  const tokens = theme.isDark
    ? APP_COLOR_PRESETS[colorPreset].dark
    : APP_COLOR_PRESETS[colorPreset].light;

  return useMemo(() => {
    const entries: Record<`--${string}`, string> = {};
    for (const [key, value] of Object.entries(tokens)) {
      entries[key as `--${string}`] = value;
    }
    entries["--success"] = tokens["--primary"] ?? "92 96% 65%";
    entries["--warning"] = "45 93% 47%";
    return vars(entries);
  }, [tokens]);
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  useDeepLinkHandler();
  useAutoLock();

  const [fontsLoaded] = useFonts({
    Phudu: require("../assets/fonts/Phudu.ttf"),
  });

  const [mode, setMode] = useState<ThemeMode>("dark");
  const [themeReady, setThemeReady] = useState(false);

  const hydrated = useRef(false);
  if (!hydrated.current) {
    hydrated.current = true;
    getItemAsync(THEME_MODE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setMode(stored);
      }
      setThemeReady(true);
    });
  }

  const handleModeChange = useCallback((next: ThemeMode) => {
    setMode(next);
    setItemAsync(THEME_MODE_KEY, next);
  }, []);

  return (
    <SafeAreaProvider>
      <BloomThemeProvider
        mode={mode}
        colorPreset="faircoin"
        onModeChange={handleModeChange}
      >
        <AppContent ready={fontsLoaded && themeReady} />
      </BloomThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent({ ready }: { ready: boolean }) {
  const { theme } = useBloomTheme();
  const themeVars = useThemeVars();

  // Hide splash screen once fonts and theme are loaded
  const splashHidden = useRef(false);
  if (ready && !splashHidden.current) {
    splashHidden.current = true;
    SplashScreen.hideAsync();
  }

  return (
    <View style={[{ flex: 1 }, themeVars]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.tint,
          headerTitleStyle: { color: theme.colors.text },
          contentStyle: { backgroundColor: theme.colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="lock" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="masternode" options={{ title: "Masternode", presentation: "modal" }} />
        <Stack.Screen name="wallets" options={{ title: "Wallets", presentation: "modal" }} />
        <Stack.Screen name="contacts" options={{ title: "Contacts", presentation: "modal" }} />
        <Stack.Screen name="export-key" options={{ title: "Export Key", presentation: "modal" }} />
        <Stack.Screen name="coin-control" options={{ title: "Coin Control", presentation: "modal" }} />
        <Stack.Screen name="peers" options={{ headerShown: false, presentation: "modal" }} />
        <Stack.Screen name="transaction/[txid]" options={{ title: "Transaction" }} />
      </Stack>
    </View>
  );
}
