/**
 * Root layout for FAIRWallet.
 * Sets up Stack navigation, dark theme, status bar, and deep link handling.
 */

// Crypto polyfill MUST be imported before any crypto library usage.
// React Native does not expose crypto.getRandomValues by default.
import "../src/crypto-polyfill";

import "../global.css";

import { useCallback } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { parseFairCoinURI } from "../src/core/uri";
import { useWalletStore } from "../src/wallet/wallet-store";

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

  // Check for initial URL (app opened via deep link)
  const checkInitialURL = useCallback(async () => {
    const url = await Linking.getInitialURL();
    if (url) {
      handleDeepLink({ url });
    }
  }, [handleDeepLink]);

  // Listen for incoming URLs while app is running
  Linking.addEventListener("url", handleDeepLink);

  return { checkInitialURL };
}

export default function RootLayout() {
  useDeepLinkHandler();

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
      </Stack>
    </SafeAreaProvider>
  );
}
