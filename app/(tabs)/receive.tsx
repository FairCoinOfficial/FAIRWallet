/**
 * Receive screen.
 * Displays current receive address with QR code and copy action.
 */

import { useCallback } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useWalletStore } from "../../src/wallet/wallet-store";
import { Button } from "../../src/ui/components/Button";

export default function ReceiveScreen() {
  const receiveAddress = useWalletStore((s) => s.currentReceiveAddress);
  const getNewAddress = useWalletStore((s) => s.getNewAddress);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(receiveAddress);
    Alert.alert("Copied", "Address copied to clipboard");
  }, [receiveAddress]);

  const handleNewAddress = useCallback(() => {
    getNewAddress();
  }, [getNewAddress]);

  if (!receiveAddress) {
    return (
      <SafeAreaView className="flex-1 bg-fair-dark" edges={["top", "left", "right"]}>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#9ffb50" />
          <Text className="text-fair-muted text-sm mt-4">
            Generating receive address...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-fair-dark" edges={["top", "left", "right"]}>
      <View className="flex-1 items-center px-6 pt-8">
        {/* Title */}
        <Text className="text-white text-xl font-bold mb-2">
          Receive FAIR
        </Text>
        <Text className="text-fair-muted text-sm mb-8 text-center">
          Share this address to receive FairCoin
        </Text>

        {/* QR Code */}
        <View className="w-56 h-56 items-center justify-center mb-6">
          <QRCode
            value={`faircoin:${receiveAddress}`}
            size={200}
            color="#9ffb50"
            backgroundColor="transparent"
          />
        </View>

        {/* Address display */}
        <Pressable
          className="bg-fair-dark-light border border-fair-border rounded-xl p-4 w-full mb-2"
          onPress={handleCopy}
        >
          <Text
            className="text-white text-sm text-center font-mono"
            selectable
          >
            {receiveAddress}
          </Text>
        </Pressable>

        {/* Actions */}
        <View className="w-full gap-3">
          <Button
            title="Copy Address"
            onPress={handleCopy}
            variant="primary"
          />
          <Button
            title="New Address"
            onPress={handleNewAddress}
            variant="outline"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
