/**
 * Send screen.
 * Allows user to send FAIR to an address with fee selection.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Clipboard from "expo-clipboard";
import {
  useWalletStore,
  getDatabase,
  type FeeLevel,
} from "../../src/wallet/wallet-store";
import { useContactsStore } from "../../src/wallet/contacts-store";
import {
  Card,
  Button,
  ListItem,
  Divider,
  Section,
  EmptyState,
} from "../../src/ui/components";
import { QRScanner } from "../../src/ui/components/QRScanner";
import { ContactPicker } from "../../src/ui/components/ContactPicker";
import { getCachedPrice } from "../../src/services/price";
import type { RecentRecipientRow } from "../../src/storage/database";
import { useTheme } from "@oxyhq/bloom";

const FEE_LEVELS: FeeLevel[] = ["low", "medium", "high"];

const FEE_LABELS: Record<FeeLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Format satoshis (bigint) to FAIR display string */
function formatSats(sats: bigint): string {
  const abs = sats < 0n ? -sats : sats;
  const whole = abs / 100_000_000n;
  const frac = abs % 100_000_000n;
  return `${whole.toString()}.${frac.toString().padStart(8, "0")}`;
}

/**
 * Parse a FAIR decimal string to satoshis (bigint) using string-based
 * arithmetic to avoid floating-point precision issues.
 * Returns null for invalid or empty input.
 */
function parseFairToSats(input: string): bigint | null {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed === ".") return null;

  const parts = trimmed.split(".");
  if (parts.length > 2) return null;

  const wholePart = parts[0] ?? "0";
  const fracPart = (parts[1] ?? "").padEnd(8, "0").slice(0, 8);

  try {
    const wholeNum = BigInt(wholePart);
    const fracNum = BigInt(fracPart);

    return wholeNum * 100_000_000n + fracNum;
  } catch {
    return null;
  }
}

export default function SendScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const balance = useWalletStore((s) => s.balance);
  const sendTransaction = useWalletStore((s) => s.sendTransaction);
  const estimateFee = useWalletStore((s) => s.estimateFee);
  const loading = useWalletStore((s) => s.loading);
  const isWatchOnly = useWalletStore((s) => s.isWatchOnly);
  const getContactByAddress = useContactsStore((s) => s.getContactByAddress);
  const theme = useTheme();

  // Watch-only wallets cannot send transactions
  if (isWatchOnly) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon="lock"
          title="Watch-Only Wallet"
          subtitle="Sending is disabled for watch-only wallets. Import the full wallet with a recovery phrase to enable sending."
        />
      </View>
    );
  }

  // Read deep link params (from faircoin: URI or QR scan navigation)
  const params = useLocalSearchParams<{ address?: string; amount?: string }>();

  const [toAddress, setToAddress] = useState(params.address ?? "");
  const [amount, setAmount] = useState(params.amount ?? "");
  const [feeLevel, setFeeLevel] = useState<FeeLevel>("medium");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recentRecipients, setRecentRecipients] = useState<
    RecentRecipientRow[]
  >([]);

  const fee = useMemo(() => estimateFee(feeLevel), [estimateFee, feeLevel]);

  const total = useMemo(() => {
    const amountSats = parseFairToSats(amount);
    if (amountSats === null || amountSats === 0n) return "0.00000000";
    return formatSats(amountSats + fee);
  }, [amount, fee]);

  const validationError = useMemo(() => {
    if (toAddress.length > 0 && toAddress.length < 25) {
      return "Address too short";
    }
    if (
      toAddress.length > 0 &&
      !toAddress.startsWith("F") &&
      !toAddress.startsWith("T")
    ) {
      return "Invalid FairCoin address format";
    }
    const amountSats = parseFairToSats(amount);
    if (amount.length > 0 && (amountSats === null || amountSats <= 0n)) {
      return "Invalid amount";
    }
    if (amountSats !== null && amountSats > 0n) {
      const totalSats = amountSats + fee;
      if (totalSats > balance) {
        return "Insufficient balance";
      }
    }
    return null;
  }, [toAddress, amount, balance, fee]);

  const amountSatsForCanSend = parseFairToSats(amount);
  const canSend =
    toAddress.length >= 25 &&
    amountSatsForCanSend !== null &&
    amountSatsForCanSend > 0n &&
    validationError === null;

  const usdEquivalent = useMemo(() => {
    const price = getCachedPrice();
    const sats = parseFairToSats(amount);
    if (price && sats !== null && sats > 0n) {
      const fair = Number(sats) / 100_000_000;
      return (fair * price.usd).toFixed(2);
    }
    return null;
  }, [amount]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setToAddress(text.trim());
      }
    } catch {
      setError("Failed to read clipboard");
    }
  }, []);

  const handleQRScan = useCallback((address: string) => {
    setToAddress(address);
  }, []);

  const handleOpenScanner = useCallback(() => {
    setShowQRScanner(true);
  }, []);

  const handleCloseScanner = useCallback(() => {
    setShowQRScanner(false);
  }, []);

  const handleOpenContactPicker = useCallback(() => {
    setShowContactPicker(true);
  }, []);

  const handleCloseContactPicker = useCallback(() => {
    setShowContactPicker(false);
  }, []);

  const handleContactSelect = useCallback((address: string) => {
    setToAddress(address);
  }, []);

  const loadRecentRecipients = useCallback(() => {
    const db = getDatabase();
    if (db) {
      db.getRecentRecipients(5).then(setRecentRecipients);
    }
  }, []);

  const handleRecentRecipientPress = useCallback((address: string) => {
    setToAddress(address);
  }, []);

  const handleMax = useCallback(() => {
    const maxSats = balance > fee ? balance - fee : 0n;
    setAmount(formatSats(maxSats));
  }, [balance, fee]);

  const handleSendPress = useCallback(() => {
    setError(null);
    setSuccess(null);
    setShowConfirmModal(true);
  }, []);

  const handleConfirmSend = useCallback(async () => {
    setShowConfirmModal(false);
    setError(null);
    try {
      const amountSats = parseFairToSats(amount);
      if (amountSats === null || amountSats <= 0n) {
        setError("Invalid amount");
        return;
      }
      const feeRate = feeLevel === "high" ? 10 : feeLevel === "medium" ? 5 : 1;
      const sentAddress = toAddress;
      const txid = await sendTransaction(sentAddress, amountSats, feeRate);
      setSuccess(`Transaction sent: ${txid}`);
      setToAddress("");
      setAmount("");

      // Record recent recipient
      const db = getDatabase();
      if (db) {
        db.addRecentRecipient(sentAddress);
        loadRecentRecipients();

        // Prompt to save as contact if not already saved
        const existingContact = await getContactByAddress(db, sentAddress);
        if (!existingContact) {
          const truncated =
            sentAddress.length > 16
              ? `${sentAddress.slice(0, 8)}...${sentAddress.slice(-8)}`
              : sentAddress;
          Alert.alert("Save Contact?", `Save ${truncated} to contacts?`, [
            { text: "No", style: "cancel" },
            {
              text: "Save",
              onPress: () => {
                router.push("/contacts");
              },
            },
          ]);
        }
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to send transaction";
      setError(msg);
    }
  }, [
    toAddress,
    amount,
    feeLevel,
    sendTransaction,
    getContactByAddress,
    loadRecentRecipients,
    router,
  ]);

  const handleCancelSend = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

  return (
    <View className="flex-1 bg-background" onLayout={loadRecentRecipients}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-8 gap-4"
        contentContainerStyle={{ paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Recent recipients */}
        {recentRecipients.length > 0 ? (
          <View>
            <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2 px-1">
              Recent Recipients
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {recentRecipients.map((r) => (
                  <Pressable
                    key={r.address}
                    onPress={() => handleRecentRecipientPress(r.address)}
                  >
                    <Card className="px-3 py-2">
                      <Text className="text-white text-xs">
                        {r.address.length > 16
                          ? `${r.address.slice(0, 6)}...${r.address.slice(-6)}`
                          : r.address}
                      </Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* To Address */}
        <Section title="To Address">
          <View className="px-4 py-3">
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 text-white text-base mr-2"
                placeholder="FairCoin address"
                placeholderTextColor={theme.colors.textSecondary}
                onChangeText={setToAddress}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View className="flex-row gap-2 mt-3">
              <Pressable
                className="flex-row items-center bg-background rounded-lg px-3 py-2"
                onPress={handlePaste}
              >
                <MaterialCommunityIcons
                  name="content-paste"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text className="text-primary text-xs ml-1.5">Paste</Text>
              </Pressable>
              <Pressable
                className="flex-row items-center bg-background rounded-lg px-3 py-2"
                onPress={handleOpenScanner}
              >
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text className="text-primary text-xs ml-1.5">QR</Text>
              </Pressable>
              <Pressable
                className="flex-row items-center bg-background rounded-lg px-3 py-2"
                onPress={handleOpenContactPicker}
              >
                <MaterialCommunityIcons
                  name="account-box"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text className="text-primary text-xs ml-1.5">
                  Contacts
                </Text>
              </Pressable>
            </View>
          </View>
        </Section>

        {/* Address validation */}
        {validationError && toAddress.length > 0 ? (
          <Text className="text-red-400 text-xs px-1">{validationError}</Text>
        ) : null}

        {/* Amount */}
        <Section title="Amount (FAIR)">
          <View className="px-4 py-3">
            <View className="flex-row items-center">
              <Text className="text-primary text-lg font-bold mr-2">
                {"\u29BE"}
              </Text>
              <TextInput
                className="flex-1 text-white text-base mr-2"
                placeholder="0.00000000"
                placeholderTextColor={theme.colors.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Pressable
                className="bg-background rounded-lg px-3 py-2"
                onPress={handleMax}
              >
                <Text className="text-primary text-xs font-medium">Max</Text>
              </Pressable>
            </View>
            {usdEquivalent ? (
              <Text className="text-muted-foreground text-xs mt-2">
                {"\u2248"} ${usdEquivalent} USD
              </Text>
            ) : null}
            <Text className="text-muted-foreground text-xs mt-1">
              Available: {formatSats(balance)} FAIR
            </Text>
          </View>
        </Section>

        {/* Fee selector */}
        <Section title="Network Fee">
          <View className="flex-row gap-2 p-3">
            {FEE_LEVELS.map((level) => {
              const isSelected = feeLevel === level;
              return (
                <Pressable
                  key={level}
                  className={`flex-1 rounded-xl py-3 items-center border ${
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-background border-border"
                  }`}
                  onPress={() => setFeeLevel(level)}
                >
                  <Text
                    className={`text-sm font-medium ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {FEE_LABELS[level]}
                  </Text>
                  <Text className="text-muted-foreground text-xs mt-1">
                    {estimateFee(level).toString()} sats
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Summary */}
        <Section title="Summary">
          <ListItem
            title="Amount"
            value={`${amount || "0.00000000"} FAIR`}
            showChevron={false}
          />
          <ListItem
            title="Fee"
            value={`${formatSats(fee)} FAIR`}
            showChevron={false}
          />
          <Divider className="mx-4" />
          <ListItem
            title="Total"
            value={`${total} FAIR`}
            showChevron={false}
            isLast
          />
        </Section>

        {/* Error / Success messages */}
        {error ? (
          <Card className="border border-red-600/50 p-4">
            <Text className="text-red-400 text-sm text-center">{error}</Text>
          </Card>
        ) : null}
        {success ? (
          <Card className="border border-green-600/50 p-4">
            <Text className="text-primary text-sm text-center">
              {success}
            </Text>
          </Card>
        ) : null}

        {/* Send button */}
        <Button
          title="Send FAIR"
          onPress={handleSendPress}
          variant="primary"
          disabled={!canSend}
          loading={loading}
        />

        {/* Confirmation modal */}
        <Modal
          visible={showConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancelSend}
        >
          <View className="flex-1 bg-black/70 items-center justify-center px-8">
            <Card className="p-6 w-full max-w-sm border border-border">
              <Text className="text-white text-lg font-bold mb-4 text-center">
                Confirm Transaction
              </Text>
              <ListItem
                title="To"
                subtitle={toAddress}
                showChevron={false}
              />
              <ListItem
                title="Amount"
                value={`${amount} FAIR`}
                showChevron={false}
              />
              <ListItem
                title="Fee"
                value={`${formatSats(fee)} FAIR`}
                showChevron={false}
              />
              <Divider className="mx-4" />
              <ListItem
                title="Total"
                value={`${total} FAIR`}
                showChevron={false}
                isLast
              />
              <View className="gap-3 mt-4">
                <Button
                  title="Confirm Send"
                  onPress={handleConfirmSend}
                  variant="primary"
                />
                <Button
                  title="Cancel"
                  onPress={handleCancelSend}
                  variant="secondary"
                />
              </View>
            </Card>
          </View>
        </Modal>

        {/* QR Scanner */}
        <QRScanner
          visible={showQRScanner}
          onScan={handleQRScan}
          onClose={handleCloseScanner}
        />

        {/* Contact Picker */}
        <ContactPicker
          visible={showContactPicker}
          onSelect={handleContactSelect}
          onClose={handleCloseContactPicker}
        />
      </ScrollView>
    </View>
  );
}
