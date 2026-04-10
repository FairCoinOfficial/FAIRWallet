/**
 * Welcome screen - entry point for new users.
 */

import { useCallback } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/ui/components/Button";

export default function WelcomeScreen() {
  const router = useRouter();

  const handleCreate = useCallback(() => {
    router.push("/onboarding/create");
  }, [router]);

  const handleRestore = useCallback(() => {
    router.push("/onboarding/restore");
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-fair-dark">
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo / Title */}
        <View className="items-center mb-16">
          <Text className="text-fair-green text-5xl font-bold mb-4">
            FAIR
          </Text>
          <Text className="text-fair-green text-2xl font-light tracking-widest">
            Wallet
          </Text>
          <Text className="text-white text-base mt-6 opacity-80">
            Your FairCoin wallet
          </Text>
        </View>

        {/* Buttons */}
        <View className="w-full gap-4">
          <Button
            title="Create New Wallet"
            onPress={handleCreate}
            variant="primary"
          />
          <Button
            title="Restore Wallet"
            onPress={handleRestore}
            variant="outline"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
