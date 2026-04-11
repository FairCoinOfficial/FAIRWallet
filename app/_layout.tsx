/**
 * Root layout for FAIRWallet.
 * Sets up Stack navigation, dark theme, status bar, deep link handling,
 * auto-lock timer, and i18n initialization.
 */

// Crypto polyfill MUST be imported before any crypto library usage.
// React Native does not expose crypto.getRandomValues by default.
import "../src/crypto-polyfill";

import "../global.css";

import { useCallback, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { parseFairCoinURI } from "../src/core/uri";
import { useWalletStore } from "../src/wallet/wallet-store";
import { getAutoLockTimeout } from "../src/storage/secure-store";
import { initLanguage } from "../src/i18n";

// Initialize language detection on module load (runs once)
initLanguage();

/**
 * Handle incoming faircoin: deep links.
 * Parses the URI and navigates to the send screen with pre-filled data.
 */
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
          params: {
            address: parsed.address,
            amount: parsed.amount ?? "",
          },
        });
      }
    },
    [router, initialized],
  );

  // Subscribe to deep links once via ref to avoid re-subscriptions.
  const linkSubscriptionRef = useRef<ReturnType<typeof Linking.addEventListener> | null>(null);
  if (linkSubscriptionRef.current === null) {
    linkSubscriptionRef.current = Linking.addEventListener("url", handleDeepLink);
  }

  // Check for initial URL (app opened via deep link) once on mount via ref.
  const initialURLChecked = useRef(false);
  if (!initialURLChecked.current) {
    initialURLChecked.current = true;
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });
  }
}

/**
 * Auto-lock timer: tracks when the app goes to background and
 * navigates to /lock if the elapsed time exceeds the configured timeout.
 */
function useAutoLock() {
  const router = useRouter();
  const initialized = useWalletStore((s) => s.initialized);
  const backgroundTimestamp = useRef<number | null>(null);

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      if (!initialized) return;

      if (nextState === "background" || nextState === "inactive") {
        backgroundTimestamp.current = Date.now();
      } else if (nextState === "active" && backgroundTimestamp.current !== null) {
        const elapsed = Date.now() - backgroundTimestamp.current;
        backgroundTimestamp.current = null;

        // Check async but don't block - use a promise chain
        getAutoLockTimeout().then((minutes) => {
          const timeoutMs = minutes * 60 * 1000;
          if (elapsed > timeoutMs) {
            router.replace("/lock");
          }
        });
      }
    },
    [initialized, router],
  );

  // Subscribe to AppState changes via ref to avoid re-subscriptions.
  // The subscription is set up once and the callback is stable via useCallback.
  const subscriptionRef = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  if (subscriptionRef.current === null) {
    subscriptionRef.current = AppState.addEventListener("change", handleAppStateChange);
  }
}

export default function RootLayout() {
  useDeepLinkHandler();
  useAutoLock();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#1b1e09" },
          headerTintColor: "#9ffb50",
          headerTitleStyle: { color: "#ffffff" },
          contentStyle: { backgroundColor: "#1b1e09" },
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
          options={{
            title: "Masternode",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="wallets"
          options={{
            title: "Wallets",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="contacts"
          options={{
            title: "Contacts",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="export-key"
          options={{
            title: "Export Key",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="coin-control"
          options={{
            title: "Coin Control",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="peers"
          options={{
            title: "Network Peers",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="transaction/[txid]"
          options={{
            title: "Transaction",
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
