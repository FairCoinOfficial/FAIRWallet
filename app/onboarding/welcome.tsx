/**
 * Welcome screen — clean, minimal entry point for new users.
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
      <View className="flex-1 items-center justify-between px-8 pt-20 pb-10">
        {/* Brand */}
        <View className="flex-1 items-center justify-center">
          <Text className="text-fair-green text-7xl mb-6">{"\u229C"}</Text>
          <Text className="text-white text-3xl font-bold tracking-wider mb-3">
            FAIRWallet
          </Text>
          <Text className="text-fair-muted text-base tracking-widest">
            Secure. Private. Yours.
          </Text>
        </View>

        {/* Actions */}
        <View className="w-full gap-4">
          <Button
            title="Create Wallet"
            onPress={handleCreate}
            variant="primary"
            size="lg"
          />
          <Button
            title="Restore Wallet"
            onPress={handleRestore}
            variant="outline"
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
