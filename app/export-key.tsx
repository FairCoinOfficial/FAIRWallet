/**
 * BIP38 encrypted private key export screen.
 * Allows users to export an encrypted version of their private key
 * for a specific address, protected by a passphrase.
 * Presented as a modal from settings.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useWalletStore } from "../src/wallet/wallet-store";
import { verifyPin } from "../src/storage/secure-store";
import { encryptBIP38 } from "../src/core/bip38";
import { getNetwork } from "../src/core/network";
import { KeyManager } from "../src/wallet/key-manager";
import {
  Card,
  Button,
  ListItem,
  Section,
  EmptyState,
  ScreenHeader,
} from "../src/ui/components";
import { PinDots } from "../src/ui/components/PinDots";
import { PinPad } from "../src/ui/components/PinPad";
import { useTheme } from "@oxyhq/bloom";

const PIN_LENGTH = 6;

// ---------------------------------------------------------------------------
// Step type for the export flow
// ---------------------------------------------------------------------------

type ExportStep = "pin" | "select" | "passphrase" | "result";

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExportKeyScreen() {
  const addresses = useWalletStore((s) => s.addresses);
  const network = useWalletStore((s) => s.network);
  const theme = useTheme();

  const [step, setStep] = useState<ExportStep>("pin");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [encryptedKey, setEncryptedKey] = useState<string | null>(null);
  const [encrypting, setEncrypting] = useState(false);

  // ---------------------------------------------------------------------------
  // PIN verification step
  // ---------------------------------------------------------------------------

  const handlePinDigit = useCallback(
    (digit: string) => {
      if (pinVerifying) return;
      setPinError(null);

      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + digit;

        if (next.length === PIN_LENGTH) {
          setPinVerifying(true);
          verifyPin(next)
            .then((correct) => {
              if (correct) {
                setPin("");
                setStep("select");
              } else {
                setPinError("Wrong PIN. Try again.");
                setPin("");
              }
              setPinVerifying(false);
            })
            .catch(() => {
              setPinError("Verification failed.");
              setPin("");
              setPinVerifying(false);
            });
        }

        return next;
      });
    },
    [pinVerifying],
  );

  const handlePinBackspace = useCallback(() => {
    if (pinVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setPinError(null);
  }, [pinVerifying]);

  // ---------------------------------------------------------------------------
  // Address selection step
  // ---------------------------------------------------------------------------

  const handleSelectAddress = useCallback((address: string) => {
    setSelectedAddress(address);
    setStep("passphrase");
  }, []);

  // ---------------------------------------------------------------------------
  // Passphrase step
  // ---------------------------------------------------------------------------

  const passphraseError = useMemo(() => {
    if (passphrase.length > 0 && passphrase.length < 8) {
      return "Passphrase must be at least 8 characters";
    }
    if (confirmPassphrase.length > 0 && passphrase !== confirmPassphrase) {
      return "Passphrases do not match";
    }
    return null;
  }, [passphrase, confirmPassphrase]);

  const canEncrypt =
    passphrase.length >= 8 &&
    passphrase === confirmPassphrase &&
    selectedAddress !== null;

  const handleEncrypt = useCallback(async () => {
    if (!canEncrypt || !selectedAddress) return;

    setEncrypting(true);
    try {
      const networkConfig = getNetwork(network);
      const { getMnemonic } = await import("../src/storage/secure-store");
      const mnemonic = await getMnemonic();
      if (!mnemonic) {
        Alert.alert("Error", "Could not access wallet mnemonic.");
        setEncrypting(false);
        return;
      }

      const km = KeyManager.fromMnemonic(mnemonic, networkConfig);
      let privateKey: Uint8Array | null = null;

      try {
        privateKey = km.getPrivateKeyForAddress(selectedAddress);
      } catch {
        Alert.alert("Error", "Could not find private key for this address.");
        setEncrypting(false);
        return;
      }

      const encrypted = await encryptBIP38(
        privateKey,
        passphrase,
        true, // compressed
        networkConfig,
      );

      setEncryptedKey(encrypted);
      setStep("result");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Encryption failed";
      Alert.alert("Error", message);
    } finally {
      setEncrypting(false);
    }
  }, [canEncrypt, selectedAddress, passphrase, network]);

  // ---------------------------------------------------------------------------
  // Result step
  // ---------------------------------------------------------------------------

  const handleCopyEncrypted = useCallback(async () => {
    if (encryptedKey) {
      await Clipboard.setStringAsync(encryptedKey);
      Alert.alert("Copied", "Encrypted key copied to clipboard");
    }
  }, [encryptedKey]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (step === "pin") {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        edges={["top", "bottom", "left", "right"]}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white text-xl font-bold mb-2">Verify PIN</Text>
          <Text className="text-muted-foreground text-sm mb-6 text-center">
            Enter your PIN to access private key export
          </Text>

          <View className="mb-4">
            <PinDots
              length={PIN_LENGTH}
              filled={pin.length}
              error={pinError !== null}
            />
          </View>

          {pinError ? (
            <Text className="text-red-400 text-xs text-center mb-3">
              {pinError}
            </Text>
          ) : null}

          <PinPad
            onDigit={handlePinDigit}
            onBackspace={handlePinBackspace}
            disabled={pinVerifying}
            tintColor={theme.colors.text}
            disabledColor={theme.colors.card}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (step === "select") {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        edges={["top", "bottom", "left", "right"]}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-4 pb-8"
        >
          <ScreenHeader
            title="Select Address"
            subtitle="Choose the address whose private key you want to export"
          />

          <Section className="mt-4">
            {addresses.length === 0 ? (
              <EmptyState
                icon="key-remove"
                title="No addresses found"
                subtitle="No addresses available for key export"
              />
            ) : (
              addresses.map((address, idx) => (
                <ListItem
                  key={`addr-${idx}-${address}`}
                  icon="key"
                  title={address}
                  subtitle={`#${idx + 1}`}
                  isLast={idx === addresses.length - 1}
                  onPress={() => handleSelectAddress(address)}
                />
              ))
            )}
          </Section>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === "passphrase") {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        edges={["top", "bottom", "left", "right"]}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title="Set Encryption Passphrase"
            subtitle="This passphrase will be needed to decrypt the exported key. Choose a strong passphrase and store it safely."
          />

          <Card className="p-4 mt-4 mb-4">
            <Text className="text-muted-foreground text-xs mb-1">Passphrase</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-white text-base mb-3"
              placeholder="Enter passphrase (min 8 characters)"
              placeholderTextColor={theme.colors.textSecondary}
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text className="text-muted-foreground text-xs mb-1">
              Confirm Passphrase
            </Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-white text-base"
              placeholder="Confirm passphrase"
              placeholderTextColor={theme.colors.textSecondary}
              value={confirmPassphrase}
              onChangeText={setConfirmPassphrase}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {passphraseError ? (
              <Text className="text-red-400 text-xs mt-3">
                {passphraseError}
              </Text>
            ) : null}
          </Card>

          <Button
            title={encrypting ? "Encrypting..." : "Encrypt Private Key"}
            onPress={handleEncrypt}
            variant="primary"
            disabled={!canEncrypt}
            loading={encrypting}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Result step
  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8"
      >
        <ScreenHeader
          title="Encrypted Key"
          subtitle="Your BIP38 encrypted private key"
        />

        {/* Encrypted key display */}
        <Pressable onPress={handleCopyEncrypted}>
          <Card className="p-4 mt-4 mb-4 border border-primary">
            <Text
              className="text-primary text-sm text-center font-mono"
              selectable
            >
              {encryptedKey}
            </Text>
          </Card>
        </Pressable>

        <Button
          title="Copy Encrypted Key"
          onPress={handleCopyEncrypted}
          variant="primary"
          icon={
            <MaterialCommunityIcons
              name="content-copy"
              size={18}
              color={theme.colors.background}
            />
          }
        />

        {/* Warning */}
        <Card className="p-4 mt-6">
          <Text className="text-yellow-400 text-sm font-semibold mb-1">
            Important
          </Text>
          <Text className="text-yellow-400/80 text-xs leading-5">
            This encrypted key requires the passphrase to decrypt. Keep both
            safe. Without the passphrase, the private key cannot be recovered
            from this encrypted form.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
