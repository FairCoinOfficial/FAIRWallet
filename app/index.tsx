/**
 * Entry redirect screen.
 * Checks for existing wallet, initializes it from secure store,
 * and routes to the appropriate screen (onboarding, lock, or tabs).
 */

import { useCallback, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { useWalletStore } from "../src/wallet/wallet-store";
import { getMnemonic, hasPin } from "../src/storage/secure-store";
import { useTheme } from "@oxyhq/bloom";

type AppState = "checking" | "onboarding" | "locked" | "ready" | "error";

export default function IndexScreen() {
  const [appState, setAppState] = useState<AppState>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasWallet = useWalletStore((s) => s.hasWallet);
  const initialize = useWalletStore((s) => s.initialize);
  const initialized = useWalletStore((s) => s.initialized);
  const theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const boot = async () => {
        try {
          const exists = await hasWallet();
          if (!exists) {
            if (!cancelled) setAppState("onboarding");
            return;
          }

          // Wallet exists - load mnemonic and initialize
          if (!initialized) {
            const mnemonic = await getMnemonic();
            if (!mnemonic) {
              if (!cancelled) setAppState("onboarding");
              return;
            }
            await initialize(mnemonic);
          }

          // Check if PIN is set - route to lock screen if so
          const pinSet = await hasPin();
          if (pinSet) {
            if (!cancelled) setAppState("locked");
            return;
          }

          if (!cancelled) setAppState("ready");
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Failed to load wallet";
          if (!cancelled) {
            setErrorMsg(msg);
            setAppState("error");
          }
        }
      };
      boot();
      return () => {
        cancelled = true;
      };
    }, [hasWallet, initialize, initialized]),
  );

  if (appState === "onboarding") {
    return <Redirect href="/onboarding/welcome" />;
  }

  if (appState === "locked") {
    return <Redirect href="/lock" />;
  }

  if (appState === "ready") {
    return <Redirect href="/(tabs)" />;
  }

  if (appState === "error") {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-red-400 text-base text-center mb-4">
          {errorMsg}
        </Text>
        <Text className="text-muted-foreground text-sm text-center">
          Try restarting the app or wiping and restoring your wallet.
        </Text>
      </View>
    );
  }

  // "checking" state
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text className="text-muted-foreground text-sm mt-4">Loading wallet...</Text>
    </View>
  );
}
