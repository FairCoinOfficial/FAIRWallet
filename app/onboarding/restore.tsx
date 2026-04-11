/**
 * Restore wallet screen — clean mnemonic input with word count feedback.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useWalletStore } from "../../src/wallet/wallet-store";
import { Button } from "../../src/ui/components/Button";
import { useColorScheme } from "../../src/theme/useColorScheme";

export default function RestoreWalletScreen() {
  const router = useRouter();
  const restoreWallet = useWalletStore((s) => s.restoreWallet);
  const loading = useWalletStore((s) => s.loading);
  const { colors } = useColorScheme();

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

  const wordCountColor = useMemo(() => {
    if (wordCount === 0) return "text-muted-foreground";
    if (isValidCount) return "text-primary";
    return "text-muted-foreground";
  }, [wordCount, isValidCount]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-24 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text className="text-white text-xl font-bold mb-2 text-center">
          Restore Your Wallet
        </Text>
        <Text className="text-muted-foreground text-sm mb-8 text-center leading-5">
          Enter your 24-word recovery phrase to restore access to your wallet.
        </Text>

        {/* Mnemonic input area */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <TextInput
            className="text-white text-base leading-6 min-h-[140px] font-mono"
            placeholder="word1 word2 word3 ..."
            placeholderTextColor={colors.mutedForeground}
            value={mnemonicInput}
            onChangeText={setMnemonicInput}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textAlignVertical="top"
          />
        </View>

        {/* Word count + paste row */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className={`text-sm font-medium ${wordCountColor}`}>
            {wordCount}/24 words
          </Text>
          <Pressable
            className="flex-row items-center gap-2 bg-surface border border-border rounded-full px-4 py-2 active:bg-primary/10"
            onPress={handlePaste}
          >
            <MaterialCommunityIcons
              name="content-paste"
              size={16}
              color={colors.primary}
            />
            <Text className="text-primary text-sm font-medium">Paste</Text>
          </Pressable>
        </View>

        {/* Validation error */}
        {error ? (
          <View className="flex-row items-start gap-3 bg-red-950/40 border border-red-600/30 rounded-2xl p-4 mb-6">
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color="#f87171"
            />
            <Text className="text-red-400 text-sm flex-1 leading-5">
              {error}
            </Text>
          </View>
        ) : null}

        {/* Restore button */}
        <Button
          title="Restore Wallet"
          onPress={handleRestore}
          variant="primary"
          size="lg"
          disabled={!isValidCount}
          loading={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
