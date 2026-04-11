/**
 * BIP38 encrypted private key export screen.
 * Allows users to export an encrypted version of their private key
 * for a specific address, protected by a passphrase.
 * Presented as a modal from settings.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useWalletStore } from "../src/wallet/wallet-store";
import { verifyPin } from "../src/storage/secure-store";
import { encryptBIP38 } from "../src/core/bip38";
import { getNetwork } from "../src/core/network";
import { KeyManager } from "../src/wallet/key-manager";
import { Button } from "../src/ui/components/Button";

const PIN_LENGTH = 6;

// ---------------------------------------------------------------------------
// Step type for the export flow
// ---------------------------------------------------------------------------

type ExportStep = "pin" | "select" | "passphrase" | "result";

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExportKeyScreen() {
  const insets = useSafeAreaInsets();
  const addresses = useWalletStore((s) => s.addresses);
  const network = useWalletStore((s) => s.network);

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
      // This is a simplified flow - in production, the KeyManager instance
      // would be accessed through a secure channel. For the export screen,
      // we need the private key for the selected address.
      // The key manager is internal to the wallet store, so we access it
      // through the store's internal state by re-deriving from the mnemonic.
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
      <View className="flex-1 bg-fair-dark" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white text-xl font-bold mb-2">Verify PIN</Text>
          <Text className="text-fair-muted text-sm mb-6 text-center">
            Enter your PIN to access private key export
          </Text>

          {/* PIN dots */}
          <View className="flex-row gap-3 mb-4">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View
                key={`pin-dot-${i}`}
                className={`w-3.5 h-3.5 rounded-full ${
                  i < pin.length ? "bg-fair-green" : "bg-fair-dark-light"
                }`}
              />
            ))}
          </View>

          {pinError ? (
            <Text className="text-red-400 text-xs text-center mb-3">
              {pinError}
            </Text>
          ) : null}

          {/* Number pad */}
          <View className="items-center">
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
              ["", "0", "back"],
            ].map((row, rowIdx) => (
              <View
                key={`row-${rowIdx}`}
                className="flex-row justify-around w-full mb-2"
              >
                {row.map((key) => {
                  if (key === "") {
                    return <View key="empty-key" className="w-16 h-12" />;
                  }
                  if (key === "back") {
                    return (
                      <Pressable
                        key="backspace-key"
                        className="w-16 h-12 items-center justify-center rounded-xl active:bg-fair-dark-light"
                        onPress={handlePinBackspace}
                      >
                        <Text className="text-fair-muted text-xl">
                          {"\u232B"}
                        </Text>
                      </Pressable>
                    );
                  }
                  return (
                    <Pressable
                      key={`pin-key-${key}`}
                      className="w-16 h-12 items-center justify-center rounded-xl bg-fair-dark-light active:bg-fair-green/20"
                      onPress={() => handlePinDigit(key)}
                    >
                      <Text className="text-white text-xl font-medium">
                        {key}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (step === "select") {
    return (
      <View className="flex-1 bg-fair-dark">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-6 pb-8"
          contentContainerStyle={{ paddingTop: insets.top }}
        >
          <Text className="text-white text-xl font-bold mb-2 text-center">
            Select Address
          </Text>
          <Text className="text-fair-muted text-sm mb-6 text-center">
            Choose the address whose private key you want to export
          </Text>

          {addresses.length === 0 ? (
            <View className="bg-fair-dark-light rounded-xl p-6 items-center">
              <Text className="text-fair-muted text-sm text-center">
                No addresses found.
              </Text>
            </View>
          ) : (
            <View className="bg-fair-dark-light rounded-xl overflow-hidden">
              {addresses.map((address, idx) => (
                <Pressable
                  key={`addr-${idx}-${address}`}
                  className={`px-4 py-3.5 ${
                    idx < addresses.length - 1 ? "border-b border-fair-border" : ""
                  } active:bg-fair-green/5`}
                  onPress={() => handleSelectAddress(address)}
                >
                  <Text className="text-white text-xs font-mono">
                    {address}
                  </Text>
                  <Text className="text-fair-muted text-xs mt-0.5">
                    #{idx + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  if (step === "passphrase") {
    return (
      <View className="flex-1 bg-fair-dark">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-6 pb-8"
          contentContainerStyle={{ paddingTop: insets.top }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-white text-xl font-bold mb-2 text-center">
            Set Encryption Passphrase
          </Text>
          <Text className="text-fair-muted text-sm mb-6 text-center">
            This passphrase will be needed to decrypt the exported key.
            Choose a strong passphrase and store it safely.
          </Text>

          <Text className="text-fair-muted text-xs mb-1">Passphrase</Text>
          <View className="bg-fair-dark-light border border-fair-border rounded-xl px-4 py-3 mb-3">
            <TextInput
              className="text-white text-base"
              placeholder="Enter passphrase (min 8 characters)"
              placeholderTextColor="#6b7280"
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text className="text-fair-muted text-xs mb-1">
            Confirm Passphrase
          </Text>
          <View className="bg-fair-dark-light border border-fair-border rounded-xl px-4 py-3 mb-4">
            <TextInput
              className="text-white text-base"
              placeholder="Confirm passphrase"
              placeholderTextColor="#6b7280"
              value={confirmPassphrase}
              onChangeText={setConfirmPassphrase}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {passphraseError ? (
            <Text className="text-red-400 text-xs mb-4">{passphraseError}</Text>
          ) : null}

          <Button
            title={encrypting ? "Encrypting..." : "Encrypt Private Key"}
            onPress={handleEncrypt}
            variant="primary"
            disabled={!canEncrypt}
            loading={encrypting}
          />
        </ScrollView>
      </View>
    );
  }

  // Result step
  return (
    <View className="flex-1 bg-fair-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-6 pb-8"
        contentContainerStyle={{ paddingTop: insets.top }}
      >
        <Text className="text-white text-xl font-bold mb-2 text-center">
          Encrypted Key
        </Text>
        <Text className="text-fair-muted text-sm mb-6 text-center">
          Your BIP38 encrypted private key
        </Text>

        {/* Encrypted key display */}
        <Pressable
          className="bg-fair-dark-light border border-fair-green rounded-xl p-4 mb-4"
          onPress={handleCopyEncrypted}
        >
          <Text
            className="text-fair-green text-sm text-center font-mono"
            selectable
          >
            {encryptedKey}
          </Text>
        </Pressable>

        <Button
          title="Copy Encrypted Key"
          onPress={handleCopyEncrypted}
          variant="primary"
        />

        {/* Warning */}
        <View className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4 mt-6">
          <Text className="text-yellow-400 text-sm font-semibold mb-1">
            Important
          </Text>
          <Text className="text-yellow-400/80 text-xs leading-5">
            This encrypted key requires the passphrase to decrypt. Keep both
            safe. Without the passphrase, the private key cannot be recovered
            from this encrypted form.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
