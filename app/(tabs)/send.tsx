/**
 * Send screen.
 * Allows user to send FAIR to an address with fee selection.
 * Revolut-inspired layout: hero amount on top, recipient card, fee pills,
 * fixed send button at the bottom.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable } from "react-native";
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
  ContactAvatar,
  ListItem,
  Divider,
  EmptyState,
} from "../../src/ui/components";
import { QRScanner } from "../../src/ui/components/QRScanner";
import { ContactPicker } from "../../src/ui/components/ContactPicker";
import { getCachedPrice } from "../../src/services/price";
import type { RecentRecipientRow, ContactRow } from "../../src/storage/database";
import { useTheme } from "@oxyhq/bloom/theme";
import * as Prompt from "@oxyhq/bloom/prompt";
import { hapticSuccess, hapticError } from "../../src/utils/haptics";
import { FONT_PHUDU_BLACK, FONT_PHUDU_LIGHT } from "../../src/utils/fonts";
import {
  formatSats,
  formatFair,
  parseFairToSats,
} from "../../src/core/format-amount";

const FEE_LEVELS: FeeLevel[] = ["low", "medium", "high"];

const FEE_LABELS: Record<FeeLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const FAIR_SYMBOL = "\u229C"; // ⊜

const CONTENT_MAX_WIDTH = 600;
const AMOUNT_FONT_SIZE_MAX = 44;
const AMOUNT_FONT_SIZE_MIN = 22;
const AMOUNT_SYMBOL_RATIO = 34 / 44;
// Length at which the amount font starts shrinking from its max size.
const AMOUNT_SHRINK_THRESHOLD = 9;
// Length at which the amount font reaches its minimum size.
const AMOUNT_SHRINK_FLOOR = 18;

/**
 * Compute a responsive font size for the hero amount based on how
 * many characters the user has typed. This is the cross-platform
 * alternative to `adjustsFontSizeToFit`, which React Native's
 * TextInput typings do not officially expose.
 */
function getAmountFontSize(length: number): number {
  if (length <= AMOUNT_SHRINK_THRESHOLD) return AMOUNT_FONT_SIZE_MAX;
  if (length >= AMOUNT_SHRINK_FLOOR) return AMOUNT_FONT_SIZE_MIN;
  const range = AMOUNT_SHRINK_FLOOR - AMOUNT_SHRINK_THRESHOLD;
  const progress = (length - AMOUNT_SHRINK_THRESHOLD) / range;
  const span = AMOUNT_FONT_SIZE_MAX - AMOUNT_FONT_SIZE_MIN;
  return Math.round(AMOUNT_FONT_SIZE_MAX - span * progress);
}

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export default function SendScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const balance = useWalletStore((s) => s.balance);
  const sendTransaction = useWalletStore((s) => s.sendTransaction);
  const estimateFee = useWalletStore((s) => s.estimateFee);
  const loading = useWalletStore((s) => s.loading);
  const isWatchOnly = useWalletStore((s) => s.isWatchOnly);
  const contacts = useContactsStore((s) => s.contacts);
  const loadContacts = useContactsStore((s) => s.loadContacts);
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
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recentRecipients, setRecentRecipients] = useState<
    RecentRecipientRow[]
  >([]);
  const [pendingSaveAddress, setPendingSaveAddress] = useState<string | null>(
    null,
  );
  const confirmControl = Prompt.usePromptControl();
  const saveContactControl = Prompt.usePromptControl();

  const fee = useMemo(() => estimateFee(feeLevel), [estimateFee, feeLevel]);

  const totalSats = useMemo<bigint>(() => {
    const amountSats = parseFairToSats(amount);
    if (amountSats === null || amountSats === 0n) return 0n;
    return amountSats + fee;
  }, [amount, fee]);

  const totalTrimmed = useMemo(() => formatFair(totalSats), [totalSats]);
  const totalExact = useMemo(() => formatSats(totalSats), [totalSats]);

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

  const matchedContact = useMemo<ContactRow | null>(() => {
    if (toAddress.length < 25) return null;
    const found = contacts.find((c) => c.address === toAddress);
    return found ?? null;
  }, [contacts, toAddress]);

  const recentRecipientLookup = useMemo(() => {
    const map = new Map<string, ContactRow>();
    for (const c of contacts) {
      map.set(c.address, c);
    }
    return map;
  }, [contacts]);

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

  const handleClearRecipient = useCallback(() => {
    setToAddress("");
  }, []);

  const loadInitialData = useCallback(() => {
    const db = getDatabase();
    if (db) {
      db.getRecentRecipients(5).then(setRecentRecipients);
      loadContacts(db);
    }
  }, [loadContacts]);

  const refreshRecentRecipients = useCallback(() => {
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
    confirmControl.open();
  }, [confirmControl]);

  const handleConfirmSend = useCallback(async () => {
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
      hapticSuccess();
      setSuccess(`Transaction sent: ${txid}`);
      setToAddress("");
      setAmount("");

      // Record recent recipient
      const db = getDatabase();
      if (db) {
        db.addRecentRecipient(sentAddress);
        refreshRecentRecipients();

        // Prompt to save as contact if not already saved
        const existingContact = await getContactByAddress(db, sentAddress);
        if (!existingContact) {
          setPendingSaveAddress(sentAddress);
          saveContactControl.open();
        }
      }
    } catch (e: unknown) {
      hapticError();
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
    refreshRecentRecipients,
    saveContactControl,
  ]);

  const hasAmount = amount.length > 0;

  const amountLengthForSizing =
    amount.length > 0 ? amount.length : "0.00000000".length;
  const amountFontSize = getAmountFontSize(amountLengthForSizing);
  const amountSymbolFontSize = Math.round(amountFontSize * AMOUNT_SYMBOL_RATIO);

  return (
    <View className="flex-1 bg-background" onLayout={loadInitialData}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-40 gap-5"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="w-full self-center gap-5"
          style={{ maxWidth: CONTENT_MAX_WIDTH }}
        >
          {/* Hero amount */}
          <View className="items-center pt-4 pb-2">
            <View className="flex-row items-baseline justify-center w-full px-4">
              <Text
                className="text-primary mr-1"
                style={{
                  fontFamily: FONT_PHUDU_LIGHT,
                  fontSize: amountSymbolFontSize,
                  includeFontPadding: false,
                }}
                numberOfLines={1}
              >
                {FAIR_SYMBOL}
              </Text>
              <TextInput
                className="text-foreground flex-shrink"
                style={{
                  fontFamily: FONT_PHUDU_BLACK,
                  fontSize: amountFontSize,
                  paddingVertical: 0,
                  includeFontPadding: false,
                }}
                placeholder="0.00000000"
                placeholderTextColor={theme.colors.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                maxLength={20}
                numberOfLines={1}
              />
            </View>
            <Pressable
              onPress={handleMax}
              className="bg-primary/10 rounded-full px-3 py-1.5 mt-2"
              accessibilityLabel="Use maximum balance"
            >
              <Text className="text-primary text-xs font-semibold">MAX</Text>
            </Pressable>
            <Text className="text-muted-foreground text-sm mt-2">
              {usdEquivalent
                ? `\u2248 $${usdEquivalent} USD`
                : `\u2248 $0.00 USD`}
            </Text>
            <Text className="text-muted-foreground text-xs mt-1">
              Available: {formatFair(balance)} FAIR
            </Text>
          </View>

          {/* Recipient card */}
          <Card className="p-4">
            <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider mb-2">
              Send to
            </Text>
            {matchedContact ? (
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="mr-3">
                    <ContactAvatar name={matchedContact.name} size={40} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground text-base font-semibold">
                      {matchedContact.name}
                    </Text>
                    <Text className="text-muted-foreground text-xs mt-0.5">
                      {truncateAddress(matchedContact.address)}
                    </Text>
                  </View>
                </View>
                <Pressable
                  className="p-2 rounded-full active:opacity-60"
                  onPress={handleClearRecipient}
                  accessibilityLabel="Clear recipient"
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            ) : (
              <TextInput
                className="text-foreground text-base"
                style={{ paddingVertical: 4 }}
                placeholder="FairCoin address"
                placeholderTextColor={theme.colors.textSecondary}
                value={toAddress}
                onChangeText={setToAddress}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={false}
              />
            )}

            <View className="flex-row gap-2 mt-3">
              <Pressable
                className="flex-row items-center bg-primary/10 rounded-full px-3 py-2 active:opacity-70"
                onPress={handlePaste}
              >
                <MaterialCommunityIcons
                  name="content-paste"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text className="text-primary text-xs ml-1.5 font-semibold">
                  Paste
                </Text>
              </Pressable>
              <Pressable
                className="flex-row items-center bg-primary/10 rounded-full px-3 py-2 active:opacity-70"
                onPress={handleOpenScanner}
              >
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text className="text-primary text-xs ml-1.5 font-semibold">
                  Scan QR
                </Text>
              </Pressable>
              <Pressable
                className="flex-row items-center bg-primary/10 rounded-full px-3 py-2 active:opacity-70"
                onPress={handleOpenContactPicker}
              >
                <MaterialCommunityIcons
                  name="account-box"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text className="text-primary text-xs ml-1.5 font-semibold">
                  Contacts
                </Text>
              </Pressable>
            </View>
          </Card>

          {validationError && toAddress.length > 0 ? (
            <Text className="text-destructive text-xs -mt-3 px-1">
              {validationError}
            </Text>
          ) : null}

          {/* Recent recipients */}
          {recentRecipients.length > 0 ? (
            <View>
              <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">
                Recent
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2 pr-4"
              >
                {recentRecipients.map((r) => {
                  const contact = recentRecipientLookup.get(r.address);
                  const isSelected = toAddress === r.address;
                  return (
                    <Pressable
                      key={r.address}
                      onPress={() => handleRecentRecipientPress(r.address)}
                      className={`flex-row items-center rounded-full px-3 py-2 ${
                        isSelected
                          ? "bg-primary/20 border border-primary"
                          : "bg-surface border border-transparent"
                      }`}
                    >
                      <View className="mr-2">
                        <ContactAvatar
                          name={contact?.name ?? r.address}
                          size={28}
                        />
                      </View>
                      <Text className="text-foreground text-xs font-medium">
                        {contact?.name ?? truncateAddress(r.address)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Fee selector */}
          <View>
            <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">
              Network fee
            </Text>
            <View className="flex-row gap-2">
              {FEE_LEVELS.map((level) => {
                const isSelected = feeLevel === level;
                return (
                  <Pressable
                    key={level}
                    className={`flex-1 rounded-full py-3 items-center border ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-surface border-transparent"
                    }`}
                    onPress={() => setFeeLevel(level)}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {FEE_LABELS[level]}
                    </Text>
                    <Text className="text-muted-foreground text-[10px] mt-0.5">
                      {estimateFee(level).toString()} sats
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Error / Success messages */}
          {error ? (
            <Card className="border border-destructive/50 p-4">
              <Text className="text-destructive text-sm text-center">
                {error}
              </Text>
            </Card>
          ) : null}
          {success ? (
            <Card className="border border-primary/50 p-4">
              <Text className="text-primary text-sm text-center">
                {success}
              </Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {/* Fixed bottom bar: total + send button */}
      <View
        className="absolute left-0 right-0 bottom-0 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
      >
        <View
          className="w-full self-center px-4 gap-2"
          style={{ maxWidth: CONTENT_MAX_WIDTH }}
        >
          {hasAmount ? (
            <View className="flex-row justify-between items-center px-1">
              <Text className="text-muted-foreground text-xs">Total</Text>
              <Text
                className="text-foreground text-sm font-semibold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {totalTrimmed} FAIR
              </Text>
            </View>
          ) : null}
          <Button
            title="Send FAIR"
            onPress={handleSendPress}
            variant="primary"
            size="lg"
            disabled={!canSend}
            loading={loading}
          />
        </View>
      </View>

      {/* Confirmation prompt */}
      <Prompt.Outer control={confirmControl}>
        <Prompt.Content>
          <Prompt.TitleText>Confirm Transaction</Prompt.TitleText>
          <View className="mt-2">
            <ListItem
              title="To"
              subtitle={matchedContact ? matchedContact.name : toAddress}
              showChevron={false}
            />
            <ListItem
              title="Amount"
              value={`${formatSats(parseFairToSats(amount) ?? 0n)} FAIR`}
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
              value={`${totalExact} FAIR`}
              showChevron={false}
              isLast
            />
          </View>
        </Prompt.Content>
        <Prompt.Actions>
          <Prompt.Action
            cta="Confirm Send"
            onPress={handleConfirmSend}
            color="primary"
          />
          <Prompt.Action
            cta="Cancel"
            onPress={() => confirmControl.close()}
            color="secondary"
          />
        </Prompt.Actions>
      </Prompt.Outer>

      {/* Save contact prompt */}
      <Prompt.Basic
        control={saveContactControl}
        title="Save Contact?"
        description={
          pendingSaveAddress
            ? `Save ${
                pendingSaveAddress.length > 16
                  ? `${pendingSaveAddress.slice(0, 8)}...${pendingSaveAddress.slice(-8)}`
                  : pendingSaveAddress
              } to contacts?`
            : ""
        }
        confirmButtonCta="Save"
        cancelButtonCta="No"
        onConfirm={() => {
          router.push("/contacts");
          setPendingSaveAddress(null);
        }}
      />

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
    </View>
  );
}
