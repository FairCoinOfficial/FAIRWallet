/**
 * Root layout for FAIRWallet.
 *
 * Responsibilities:
 * - Crypto polyfill (before any crypto imports)
 * - Theme: BloomThemeProvider + NativeWind CSS variable injection
 * - Navigation: Stack router with themed headers
 * - Deep link handler for faircoin: URIs
 * - Auto-lock timer
 * - i18n initialization
 */

import "../src/crypto-polyfill";
import "../global.css";

import { useCallback, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
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

initLanguage();

const THEME_MODE_KEY = "fairwallet_theme_mode";

// ---------------------------------------------------------------------------
// Deep link handler
// ---------------------------------------------------------------------------

function useDeepLinkHandler() {
  const router = useRouter();
  const initialized = useWalletStore((s) => s.initialized);

  const handleDeepLink = useCallback(
    (event: { url: string }) => {
      const { url } = event;
      if (!url || !initialized) return;
      const parsed = parseFairCoinURI(url);
      if (parsed) {
        router.push({
          pathname: "/(tabs)/send",
          params: { address: parsed.address, amount: parsed.amount ?? "" },
        });
      }
    },
    [router, initialized],
  );

  const linkSubscriptionRef = useRef<ReturnType<
    typeof Linking.addEventListener
  > | null>(null);
  if (linkSubscriptionRef.current === null) {
    linkSubscriptionRef.current = Linking.addEventListener(
      "url",
      handleDeepLink,
    );
  }

  const initialURLChecked = useRef(false);
  if (!initialURLChecked.current) {
    initialURLChecked.current = true;
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
  }
}

// ---------------------------------------------------------------------------
// Auto-lock
// ---------------------------------------------------------------------------

function useAutoLock() {
  const router = useRouter();
  const initialized = useWalletStore((s) => s.initialized);
  const backgroundTimestamp = useRef<number | null>(null);

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      if (!initialized) return;
      if (nextState === "background" || nextState === "inactive") {
        backgroundTimestamp.current = Date.now();
      } else if (
        nextState === "active" &&
        backgroundTimestamp.current !== null
      ) {
        const elapsed = Date.now() - backgroundTimestamp.current;
        backgroundTimestamp.current = null;
        getAutoLockTimeout().then((minutes) => {
          if (elapsed > minutes * 60 * 1000) {
            router.replace("/lock");
          }
        });
      }
    },
    [initialized, router],
  );

  const subscriptionRef = useRef<ReturnType<
    typeof AppState.addEventListener
  > | null>(null);
  if (subscriptionRef.current === null) {
    subscriptionRef.current = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
  }
}

// ---------------------------------------------------------------------------
// NativeWind CSS variable bridge
//
// Bloom provides theme colors via React context (useTheme().colors).
// Tailwind classes (bg-background, text-primary, etc.) need CSS custom
// properties to resolve. This hook reads the active Bloom preset's raw
// HSL tokens and injects them as NativeWind vars() on the root View.
// ---------------------------------------------------------------------------

function useBloomCSSVars() {
  const { theme, colorPreset } = useBloomTheme();
  const preset = APP_COLOR_PRESETS[colorPreset];
  const tokens = theme.isDark ? preset.dark : preset.light;

  return useMemo(() => {
    const entries: Record<`--${string}`, string> = {};
    for (const [key, value] of Object.entries(tokens)) {
      entries[key as `--${string}`] = value;
    }
    // Add success/warning which aren't in Bloom presets
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

  const [mode, setMode] = useState<ThemeMode>("dark");

  const hydrated = useRef(false);
  if (!hydrated.current) {
    hydrated.current = true;
    getItemAsync(THEME_MODE_KEY).then((storedMode) => {
      if (
        storedMode === "light" ||
        storedMode === "dark" ||
        storedMode === "system"
      ) {
        setMode(storedMode);
      }
    });
  }

  const handleModeChange = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    setItemAsync(THEME_MODE_KEY, newMode);
  }, []);

  return (
    <SafeAreaProvider>
      <BloomThemeProvider
        mode={mode}
        colorPreset="faircoin"
        onModeChange={handleModeChange}
      >
        <RootContent />
      </BloomThemeProvider>
    </SafeAreaProvider>
  );
}

function RootContent() {
  const { theme } = useBloomTheme();
  const cssVars = useBloomCSSVars();

  return (
    <View style={[{ flex: 1 }, cssVars]}>
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
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="lock"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="masternode"
          options={{ title: "Masternode", presentation: "modal" }}
        />
        <Stack.Screen
          name="wallets"
          options={{ title: "Wallets", presentation: "modal" }}
        />
        <Stack.Screen
          name="contacts"
          options={{ title: "Contacts", presentation: "modal" }}
        />
        <Stack.Screen
          name="export-key"
          options={{ title: "Export Key", presentation: "modal" }}
        />
        <Stack.Screen
          name="coin-control"
          options={{ title: "Coin Control", presentation: "modal" }}
        />
        <Stack.Screen
          name="peers"
          options={{ title: "Network Peers", presentation: "modal" }}
        />
        <Stack.Screen
          name="transaction/[txid]"
          options={{ title: "Transaction" }}
        />
      </Stack>
    </View>
  );
}
