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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  useWalletStore,
  type FeeLevel,
} from "../../src/wallet/wallet-store";
import { Button } from "../../src/ui/components/Button";
import { QRScanner } from "../../src/ui/components/QRScanner";

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
  const balance = useWalletStore((s) => s.balance);
  const sendTransaction = useWalletStore((s) => s.sendTransaction);
  const estimateFee = useWalletStore((s) => s.estimateFee);
  const loading = useWalletStore((s) => s.loading);

  // Read deep link params (from faircoin: URI or QR scan navigation)
  const params = useLocalSearchParams<{ address?: string; amount?: string }>();

  const [toAddress, setToAddress] = useState(params.address ?? "");
  const [amount, setAmount] = useState(params.amount ?? "");
  const [feeLevel, setFeeLevel] = useState<FeeLevel>("medium");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    if (toAddress.length > 0 && !toAddress.startsWith("F") && !toAddress.startsWith("T")) {
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
      const txid = await sendTransaction(toAddress, amountSats, feeRate);
      setSuccess(`Transaction sent: ${txid}`);
      setToAddress("");
      setAmount("");
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to send transaction";
      setError(msg);
    }
  }, [toAddress, amount, feeLevel, sendTransaction]);

  const handleCancelSend = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-fair-dark" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-4 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* To Address */}
        <Text className="text-white text-sm font-medium mb-2">To Address</Text>
        <View className="bg-fair-dark-light border border-fair-border rounded-xl p-3 mb-1">
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 text-white text-base mr-2"
              placeholder="FairCoin address"
              placeholderTextColor="#6b7280"
              value={toAddress}
              onChangeText={setToAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              className="bg-fair-dark border border-fair-border rounded-lg px-3 py-1.5 mr-2"
              onPress={handlePaste}
            >
              <Text className="text-fair-green text-xs">Paste</Text>
            </Pressable>
            <Pressable
              className="bg-fair-dark border border-fair-border rounded-lg px-3 py-1.5"
              onPress={handleOpenScanner}
            >
              <Text className="text-fair-green text-xs">QR</Text>
            </Pressable>
          </View>
        </View>

        {/* Address validation */}
        {validationError && toAddress.length > 0 ? (
          <Text className="text-red-400 text-xs mb-4">{validationError}</Text>
        ) : (
          <View className="mb-4" />
        )}

        {/* Amount */}
        <Text className="text-white text-sm font-medium mb-2">
          Amount (FAIR)
        </Text>
        <View className="bg-fair-dark-light border border-fair-border rounded-xl p-3 mb-4">
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 text-white text-base mr-2"
              placeholder="0.00000000"
              placeholderTextColor="#6b7280"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Pressable
              className="bg-fair-dark border border-fair-border rounded-lg px-3 py-1.5"
              onPress={handleMax}
            >
              <Text className="text-fair-green text-xs">Max</Text>
            </Pressable>
          </View>
        </View>

        {/* Available balance */}
        <Text className="text-fair-muted text-xs mb-6">
          Available: {formatSats(balance)} FAIR
        </Text>

        {/* Fee selector */}
        <Text className="text-white text-sm font-medium mb-2">
          Network Fee
        </Text>
        <View className="flex-row gap-2 mb-6">
          {FEE_LEVELS.map((level) => (
            <Pressable
              key={level}
              className={`flex-1 rounded-xl py-3 items-center border ${
                feeLevel === level
                  ? "bg-fair-green/10 border-fair-green"
                  : "bg-fair-dark-light border-fair-border"
              }`}
              onPress={() => setFeeLevel(level)}
            >
              <Text
                className={`text-sm font-medium ${
                  feeLevel === level ? "text-fair-green" : "text-fair-muted"
                }`}
              >
                {FEE_LABELS[level]}
              </Text>
              <Text className="text-fair-muted text-xs mt-1">
                {estimateFee(level).toString()} sats
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary */}
        <View className="bg-fair-dark-light rounded-xl p-4 mb-6">
          <View className="flex-row justify-between mb-2">
            <Text className="text-fair-muted text-sm">Amount</Text>
            <Text className="text-white text-sm">
              {amount || "0.00000000"} FAIR
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-fair-muted text-sm">Fee</Text>
            <Text className="text-white text-sm">{formatSats(fee)} FAIR</Text>
          </View>
          <View className="border-t border-fair-border my-2" />
          <View className="flex-row justify-between">
            <Text className="text-white text-sm font-semibold">Total</Text>
            <Text className="text-white text-sm font-semibold">
              {total} FAIR
            </Text>
          </View>
        </View>

        {/* Error / Success messages */}
        {error ? (
          <View className="bg-red-900/30 border border-red-600/50 rounded-xl p-4 mb-4">
            <Text className="text-red-400 text-sm text-center">{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View className="bg-green-900/30 border border-green-600/50 rounded-xl p-4 mb-4">
            <Text className="text-fair-green text-sm text-center">
              {success}
            </Text>
          </View>
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
            <View className="bg-fair-dark-light border border-fair-border rounded-2xl p-6 w-full max-w-sm">
              <Text className="text-white text-lg font-bold mb-4 text-center">
                Confirm Transaction
              </Text>
              <View className="mb-4">
                <Text className="text-fair-muted text-sm mb-1">To</Text>
                <Text className="text-white text-xs font-mono">
                  {toAddress}
                </Text>
              </View>
              <View className="mb-4">
                <Text className="text-fair-muted text-sm mb-1">Amount</Text>
                <Text className="text-white text-base font-semibold">
                  {amount} FAIR
                </Text>
              </View>
              <View className="mb-6">
                <Text className="text-fair-muted text-sm mb-1">
                  Total (incl. fee)
                </Text>
                <Text className="text-white text-base font-semibold">
                  {total} FAIR
                </Text>
              </View>
              <View className="gap-3">
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
            </View>
          </View>
        </Modal>

        {/* QR Scanner */}
        <QRScanner
          visible={showQRScanner}
          onScan={handleQRScan}
          onClose={handleCloseScanner}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
