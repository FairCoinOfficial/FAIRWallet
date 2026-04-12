/**
 * Receive screen.
 * Displays current receive address with QR code, copy action,
 * and a scrollable list of all generated addresses.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import QRCode from "react-native-qrcode-svg";
import { useWalletStore } from "../../src/wallet/wallet-store";
import { Section, Card, ListItem, ActionButton } from "../../src/ui/components";
import { t } from "../../src/i18n";
import { useTheme } from "@oxyhq/bloom/theme";

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

export default function ReceiveScreen() {
  const insets = useSafeAreaInsets();
  const receiveAddress = useWalletStore((s) => s.currentReceiveAddress);
  const addresses = useWalletStore((s) => s.addresses);
  const getNewAddress = useWalletStore((s) => s.getNewAddress);
  const theme = useTheme();

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

  const handleSelectAddress = useCallback((address: string) => {
    setSelectedAddress(address);
  }, []);

  const handleCopyAddress = useCallback(async (address: string) => {
    await Clipboard.setStringAsync(address);
    Alert.alert("Copied", "Address copied to clipboard");
  }, []);

  const addressListItems = useMemo(
    () =>
      addresses.map((address, idx) => ({
        address,
        index: idx,
        isActive: address === displayAddress,
        isLast: idx === addresses.length - 1,
        label: truncateAddress(address),
      })),
    [addresses, displayAddress],
  );

  if (!receiveAddress) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text className="text-muted-foreground text-sm mt-4">
            Generating receive address...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-6 pb-8 gap-6"
        contentContainerStyle={{ paddingTop: insets.top }}
      >
        {/* Title */}
        <View>
          <Text className="text-foreground text-xl font-bold mb-1 text-center">
            {t("receive.title")}
          </Text>
          <Text className="text-muted-foreground text-sm text-center">
            Share this address to receive FairCoin
          </Text>
        </View>

        {/* QR Code + Address */}
        <Card className="p-6">
          <View className="items-center mb-4">
            <View className="w-56 h-56 items-center justify-center">
              <QRCode
                value={`faircoin:${displayAddress}`}
                size={200}
                color={theme.colors.primary}
                backgroundColor="transparent"
              />
            </View>
          </View>
          <Pressable onPress={handleCopy}>
            <Text
              className="text-foreground text-sm text-center font-mono"
              selectable
            >
              {displayAddress}
            </Text>
          </Pressable>
        </Card>

        {/* Action row */}
        <View className="flex-row justify-center gap-8">
          <ActionButton
            icon="content-copy"
            label={t("receive.copy")}
            onPress={handleCopy}
            size="sm"
          />
          <ActionButton
            icon="share-variant"
            label={t("receive.share")}
            onPress={handleShare}
            size="sm"
          />
          <ActionButton
            icon="plus-circle-outline"
            label={t("receive.new_address")}
            onPress={handleNewAddress}
            size="sm"
          />
        </View>

        {/* All addresses */}
        {addresses.length > 0 ? (
          <Section title={`Your Addresses (${addresses.length})`}>
            {addressListItems.map((item) => (
              <ListItem
                key={`${item.index}-${item.address}`}
                title={item.label}
                subtitle={`#${item.index + 1}`}
                icon={item.isActive ? "radiobox-marked" : "radiobox-blank"}
                iconColor={item.isActive ? theme.colors.primary : theme.colors.textSecondary}
                iconBg={
                  item.isActive ? "bg-primary/10" : "bg-background"
                }
                onPress={() => handleSelectAddress(item.address)}
                trailing={
                  <Pressable
                    className="p-1.5"
                    onPress={() => handleCopyAddress(item.address)}
                  >
                    <MaterialCommunityIcons
                      name="content-copy"
                      size={16}
                      color={theme.colors.primary}
                    />
                  </Pressable>
                }
                showChevron={false}
                isLast={item.isLast}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}
