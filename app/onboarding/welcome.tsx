/**
 * Welcome screen — clean, minimal entry point for new users.
 */

import { useCallback } from "react";
import { View, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/ui/components/Button";
import { FONT_PHUDU_BLACK } from "../../src/utils/fonts";

export default function WelcomeScreen() {
  const router = useRouter();

  const handleCreate = useCallback(() => {
    router.push("/onboarding/create");
  }, [router]);

  const handleRestore = useCallback(() => {
    router.push("/onboarding/restore");
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-between px-8 pt-20 pb-10">
        {/* Brand */}
        <View className="flex-1 items-center justify-center">
          <Image
            source={require("../../assets/icon.png")}
            style={{ width: 128, height: 128, marginBottom: 24, borderRadius: 28 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityRole="image"
            accessibilityLabel="FAIRWallet logo"
          />
          <Text
            className="text-foreground text-4xl tracking-wider mb-3"
            style={{ fontFamily: FONT_PHUDU_BLACK }}
          >
            FAIRWallet
          </Text>
          <Text className="text-muted-foreground text-base tracking-widest">
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
