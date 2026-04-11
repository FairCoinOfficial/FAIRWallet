/**
 * Receive screen.
 * Displays current receive address with QR code, copy action,
 * and a scrollable list of all generated addresses.
 */

import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useWalletStore } from "../../src/wallet/wallet-store";
import { Button } from "../../src/ui/components/Button";
import { t } from "../../src/i18n";

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

export default function ReceiveScreen() {
  const insets = useSafeAreaInsets();
  const receiveAddress = useWalletStore((s) => s.currentReceiveAddress);
  const addresses = useWalletStore((s) => s.addresses);
  const getNewAddress = useWalletStore((s) => s.getNewAddress);

  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const displayAddress = selectedAddress ?? receiveAddress;

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(displayAddress);
    Alert.alert("Copied", "Address copied to clipboard");
  }, [displayAddress]);

  const handleNewAddress = useCallback(() => {
    const addr = getNewAddress();
    setSelectedAddress(addr);
  }, [getNewAddress]);

  const handleShare = useCallback(async () => {
    const uri = `faircoin:${displayAddress}`;
    await Share.share({
      message: `Pay me with FairCoin:\n${uri}`,
      title: "FairCoin Payment Request",
    });
  }, [displayAddress]);

  const handleSelectAddress = useCallback(
    (address: string) => {
      setSelectedAddress(address);
    },
    [],
  );

  const handleCopyAddress = useCallback(async (address: string) => {
    await Clipboard.setStringAsync(address);
    Alert.alert("Copied", "Address copied to clipboard");
  }, []);

  if (!receiveAddress) {
    return (
      <View className="flex-1 bg-fair-dark" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#9ffb50" />
          <Text className="text-fair-muted text-sm mt-4">
            Generating receive address...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-fair-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-6 pb-8"
        contentContainerStyle={{ paddingTop: insets.top }}
      >
        {/* Title */}
        <Text className="text-white text-xl font-bold mb-1 text-center">
          {t("receive.title")}
        </Text>
        <Text className="text-fair-muted text-sm mb-6 text-center">
          Share this address to receive FairCoin
        </Text>

        {/* QR Code */}
        <View className="items-center mb-6">
          <View className="w-56 h-56 items-center justify-center">
            <QRCode
              value={`faircoin:${displayAddress}`}
              size={200}
              color="#9ffb50"
              backgroundColor="transparent"
            />
          </View>
        </View>

        {/* Selected address display */}
        <Pressable
          className="bg-fair-dark-light border border-fair-border rounded-xl p-4 w-full mb-4"
          onPress={handleCopy}
        >
          <Text
            className="text-white text-sm text-center font-mono"
            selectable
          >
            {displayAddress}
          </Text>
        </Pressable>

        {/* Actions */}
        <View className="w-full gap-3 mb-8">
          <Button
            title={t("receive.copy")}
            onPress={handleCopy}
            variant="primary"
          />
          <Button
            title={t("receive.share")}
            onPress={handleShare}
            variant="outline"
          />
          <Button
            title={t("receive.new_address")}
            onPress={handleNewAddress}
            variant="outline"
          />
        </View>

        {/* All addresses */}
        {addresses.length > 0 ? (
          <>
            <Text className="text-fair-muted text-xs font-semibold uppercase tracking-wider mb-3 px-1">
              Your Addresses ({addresses.length})
            </Text>
            <View className="bg-fair-dark-light rounded-xl overflow-hidden">
              {addresses.map((address, idx) => {
                const isActive = address === displayAddress;
                return (
                  <Pressable
                    key={`${idx}-${address}`}
                    className={`flex-row items-center justify-between px-4 py-3 ${
                      idx < addresses.length - 1 ? "border-b border-fair-border" : ""
                    } ${isActive ? "bg-fair-green/5" : ""}`}
                    onPress={() => handleSelectAddress(address)}
                    onLongPress={() => handleCopyAddress(address)}
                  >
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center">
                        {isActive ? (
                          <View className="w-2 h-2 rounded-full bg-fair-green mr-2" />
                        ) : null}
                        <Text
                          className={`text-xs font-mono ${
                            isActive ? "text-fair-green" : "text-white"
                          }`}
                        >
                          {truncateAddress(address)}
                        </Text>
                      </View>
                      <Text className="text-fair-muted text-xs mt-0.5">
                        #{idx + 1}
                      </Text>
                    </View>
                    <Pressable
                      className="bg-fair-dark border border-fair-border rounded-lg px-3 py-1.5"
                      onPress={() => handleCopyAddress(address)}
                    >
                      <Text className="text-fair-green text-xs">Copy</Text>
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-fair-muted text-xs mt-2 text-center">
              Tap to select, long press to copy
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
