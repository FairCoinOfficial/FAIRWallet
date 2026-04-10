/**
 * Restore wallet screen.
 * User enters 24-word mnemonic to restore an existing wallet.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useWalletStore } from "../../src/wallet/wallet-store";
import { Button } from "../../src/ui/components/Button";

export default function RestoreWalletScreen() {
  const router = useRouter();
  const restoreWallet = useWalletStore((s) => s.restoreWallet);
  const loading = useWalletStore((s) => s.loading);

  const [mnemonicInput, setMnemonicInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wordCount = useMemo(() => {
    const trimmed = mnemonicInput.trim();
    if (trimmed.length === 0) return 0;
    return trimmed.split(/\s+/).length;
  }, [mnemonicInput]);

  const isValidCount = wordCount === 24;

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setMnemonicInput(text.trim());
        setError(null);
      }
    } catch {
      setError("Failed to read clipboard");
    }
  }, []);

  const handleRestore = useCallback(async () => {
    setError(null);
    try {
      await restoreWallet(mnemonicInput);
      router.replace("/onboarding/pin-setup");
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to restore wallet";
      setError(msg);
    }
  }, [mnemonicInput, restoreWallet, router]);

  return (
    <SafeAreaView className="flex-1 bg-fair-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-20 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-white text-xl font-bold mb-2 text-center">
          Restore Your Wallet
        </Text>
        <Text className="text-fair-muted text-sm mb-8 text-center">
          Enter your 24-word recovery phrase to restore your wallet.
        </Text>

        {/* Mnemonic input */}
        <View className="bg-fair-dark-light border border-fair-border rounded-xl p-4 mb-4">
          <TextInput
            className="text-white text-base min-h-[120px]"
            placeholder="Enter your 24-word recovery phrase..."
            placeholderTextColor="#6b7280"
            value={mnemonicInput}
            onChangeText={setMnemonicInput}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textAlignVertical="top"
          />
        </View>

        {/* Word count and paste */}
        <View className="flex-row items-center justify-between mb-6">
          <Text
            className={`text-sm ${
              isValidCount ? "text-fair-green" : "text-fair-muted"
            }`}
          >
            {wordCount} / 24 words
          </Text>
          <Pressable
            className="bg-fair-dark-light border border-fair-border rounded-lg px-4 py-2"
            onPress={handlePaste}
          >
            <Text className="text-fair-green text-sm">Paste</Text>
          </Pressable>
        </View>

        {/* Error message */}
        {error ? (
          <View className="bg-red-900/30 border border-red-600/50 rounded-xl p-4 mb-6">
            <Text className="text-red-400 text-sm text-center">{error}</Text>
          </View>
        ) : null}

        {/* Restore button */}
        <Button
          title="Restore Wallet"
          onPress={handleRestore}
          variant="primary"
          disabled={!isValidCount}
          loading={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
