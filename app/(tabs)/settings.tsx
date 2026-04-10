/**
 * Settings screen.
 * Network, wallets, security, backup, masternode, advanced, about, and danger zone.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { useWalletStore } from "../../src/wallet/wallet-store";
import {
  verifyPin,
  isBiometricsEnabled,
  setBiometricsEnabled as storeBiometricsEnabled,
  getMnemonic,
} from "../../src/storage/secure-store";
import { Button } from "../../src/ui/components/Button";

const APP_VERSION = "1.0.0";
const PIN_LENGTH = 6;

// ---------------------------------------------------------------------------
// Settings section and row components
// ---------------------------------------------------------------------------

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View className="mb-6">
      <Text className="text-fair-muted text-xs font-semibold uppercase tracking-wider mb-2 px-1">
        {title}
      </Text>
      <View className="bg-fair-dark-light rounded-xl overflow-hidden">
        {children}
      </View>
    </View>
  );
}

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}

function SettingsRow({
  label,
  value,
  onPress,
  trailing,
  destructive = false,
}: SettingsRowProps) {
  const content = (
    <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-fair-border">
      <Text
        className={`text-sm ${destructive ? "text-red-400" : "text-white"}`}
      >
        {label}
      </Text>
      {trailing ?? (
        <View className="flex-row items-center">
          {value ? (
            <Text className="text-fair-muted text-sm mr-2">{value}</Text>
          ) : null}
          {onPress ? (
            <Text className="text-fair-muted text-sm">{"\u203A"}</Text>
          ) : null}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

// ---------------------------------------------------------------------------
// PIN entry modal (for verifying current PIN before sensitive actions)
// ---------------------------------------------------------------------------

interface PinModalProps {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onSuccess: () => void;
}

function PinModal({ visible, title, onCancel, onSuccess }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleCancel = useCallback(() => {
    setPin("");
    setError(null);
    onCancel();
  }, [onCancel]);

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (verifying) return;

      setError(null);
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + digit;

        if (next.length === PIN_LENGTH) {
          setVerifying(true);
          verifyPin(next)
            .then((correct) => {
              if (correct) {
                setPin("");
                setError(null);
                onSuccess();
              } else {
                setError("Wrong PIN. Try again.");
                setPin("");
              }
              setVerifying(false);
            })
            .catch(() => {
              setError("Verification failed. Try again.");
              setPin("");
              setVerifying(false);
            });
        }

        return next;
      });
    },
    [verifying, onSuccess],
  );

  const handleBackspace = useCallback(() => {
    if (verifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [verifying]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-8">
        <View className="bg-fair-dark-light border border-fair-border rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-white text-lg font-bold mb-2 text-center">
            {title}
          </Text>
          <Text className="text-fair-muted text-sm mb-4 text-center">
            Enter your 6-digit PIN
          </Text>

          {/* PIN dots */}
          <View className="flex-row justify-center gap-3 mb-4">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View
                key={`pin-dot-${i}`}
                className={`w-3.5 h-3.5 rounded-full ${
                  i < pin.length ? "bg-fair-green" : "bg-fair-dark"
                }`}
              />
            ))}
          </View>

          {error ? (
            <Text className="text-red-400 text-xs text-center mb-3">
              {error}
            </Text>
          ) : null}

          {/* Compact number pad */}
          <View className="items-center mb-4">
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
              ["", "0", "back"],
            ].map((row, rowIdx) => (
              <View
                key={`pin-row-${rowIdx}`}
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
                        className="w-16 h-12 items-center justify-center rounded-xl active:bg-fair-dark"
                        onPress={handleBackspace}
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
                      className="w-16 h-12 items-center justify-center rounded-xl bg-fair-dark active:bg-fair-green/20"
                      onPress={() => handleDigitPress(key)}
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

          <Button title="Cancel" onPress={handleCancel} variant="secondary" />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Recovery phrase display modal
// ---------------------------------------------------------------------------

interface RecoveryModalProps {
  visible: boolean;
  mnemonic: string;
  onDismiss: () => void;
}

function RecoveryModal({ visible, mnemonic, onDismiss }: RecoveryModalProps) {
  const words = useMemo(() => mnemonic.split(" "), [mnemonic]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-8">
        <View className="bg-fair-dark-light border border-fair-border rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-white text-lg font-bold mb-2 text-center">
            Recovery Phrase
          </Text>
          <Text className="text-fair-muted text-xs mb-4 text-center">
            Keep these words safe and never share them.
          </Text>

          <View className="flex-row flex-wrap justify-center gap-2 mb-4">
            {words.map((word, idx) => (
              <View
                key={`recovery-word-${idx}`}
                className="bg-fair-dark rounded-lg px-3 py-1.5"
              >
                <Text className="text-white text-sm">
                  <Text className="text-fair-muted">{idx + 1}. </Text>
                  {word}
                </Text>
              </View>
            ))}
          </View>

          <Button title="Done" onPress={onDismiss} variant="primary" />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main settings screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const router = useRouter();
  const network = useWalletStore((s) => s.network);
  const connectedPeers = useWalletStore((s) => s.connectedPeers);
  const chainHeight = useWalletStore((s) => s.chainHeight);
  const wipeWallet = useWalletStore((s) => s.wipeWallet);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const activeWalletName = useWalletStore((s) => s.activeWalletName);
  const wallets = useWalletStore((s) => s.wallets);

  const [showWipeModal, setShowWipeModal] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<"recovery" | "change_pin" | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryMnemonic, setRecoveryMnemonic] = useState("");

  const isMainnet = network === "mainnet";

  // Load biometrics state on focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadBiometrics = async () => {
        try {
          const [hardwareAvailable, enrolled, enabled] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
            isBiometricsEnabled(),
          ]);

          if (cancelled) return;

          setBiometricsAvailable(hardwareAvailable && enrolled);
          setBiometricsEnabled(enabled && hardwareAvailable && enrolled);
        } catch {
          // Biometrics check failed, leave disabled
        }
      };
      loadBiometrics();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const walletCountLabel = useMemo(() => {
    if (wallets.length === 0) return "No wallets";
    if (wallets.length === 1) return activeWalletName || "1 wallet";
    return `${activeWalletName || "Active"} (${wallets.length} total)`;
  }, [wallets.length, activeWalletName]);

  const handleManageWallets = useCallback(() => {
    router.push("/wallets");
  }, [router]);

  const handleToggleNetwork = useCallback(() => {
    Alert.alert(
      "Switch Network",
      `Switch to ${isMainnet ? "testnet" : "mainnet"}? This will require a resync.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: () => {
            // Network toggle will be implemented when the wallet supports live switching
          },
        },
      ],
    );
  }, [isMainnet]);

  const handleShowRecovery = useCallback(() => {
    setPinAction("recovery");
    setShowPinModal(true);
  }, []);

  const handleChangePIN = useCallback(() => {
    setPinAction("change_pin");
    setShowPinModal(true);
  }, []);

  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
    setPinAction(null);
  }, []);

  const handlePinSuccess = useCallback(async () => {
    setShowPinModal(false);
    const action = pinAction;
    setPinAction(null);

    if (action === "recovery") {
      try {
        const mnemonic = await getMnemonic();
        if (mnemonic) {
          setRecoveryMnemonic(mnemonic);
          setShowRecoveryModal(true);
        } else {
          Alert.alert("Error", "Could not retrieve recovery phrase.");
        }
      } catch {
        Alert.alert("Error", "Failed to load recovery phrase.");
      }
    } else if (action === "change_pin") {
      router.push("/onboarding/pin-setup");
    }
  }, [pinAction, router]);

  const handleRecoveryDismiss = useCallback(() => {
    setShowRecoveryModal(false);
    setRecoveryMnemonic("");
  }, []);

  const handleToggleBiometrics = useCallback(
    async (enabled: boolean) => {
      if (enabled && !biometricsAvailable) {
        Alert.alert(
          "Biometrics Unavailable",
          "Your device does not have biometric authentication set up. Please enable it in your device settings first.",
        );
        return;
      }

      try {
        if (enabled) {
          // Verify biometrics works before enabling
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Verify biometrics to enable",
            disableDeviceFallback: false,
          });

          if (!result.success) {
            return;
          }
        }

        await storeBiometricsEnabled(enabled);
        setBiometricsEnabled(enabled);
      } catch {
        Alert.alert("Error", "Failed to update biometrics setting.");
      }
    },
    [biometricsAvailable],
  );

  const handleMasternode = useCallback(() => {
    router.push("/masternode");
  }, [router]);

  const handleResync = useCallback(() => {
    Alert.alert("Resync Wallet", "This will re-download all blockchain data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Resync",
        onPress: () => refreshBalance(),
      },
    ]);
  }, [refreshBalance]);

  const handleWipePress = useCallback(() => {
    setShowWipeModal(true);
  }, []);

  const handleConfirmWipe = useCallback(async () => {
    setShowWipeModal(false);
    await wipeWallet();
    router.replace("/onboarding/welcome");
  }, [wipeWallet, router]);

  const handleCancelWipe = useCallback(() => {
    setShowWipeModal(false);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-fair-dark" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        {/* Wallets */}
        <SettingsSection title="Wallets">
          <SettingsRow
            label="Manage Wallets"
            value={walletCountLabel}
            onPress={handleManageWallets}
          />
        </SettingsSection>

        {/* Network */}
        <SettingsSection title="Network">
          <SettingsRow
            label="Network"
            trailing={
              <View className="flex-row items-center">
                <Text className="text-fair-muted text-sm mr-3">
                  {isMainnet ? "Mainnet" : "Testnet"}
                </Text>
                <Switch
                  value={!isMainnet}
                  onValueChange={handleToggleNetwork}
                  trackColor={{ false: "#3a3f1e", true: "#7cc940" }}
                  thumbColor="#ffffff"
                />
              </View>
            }
          />
        </SettingsSection>

        {/* Security */}
        <SettingsSection title="Security">
          <SettingsRow
            label="Change PIN"
            onPress={handleChangePIN}
          />
          <SettingsRow
            label="Biometrics"
            trailing={
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: "#3a3f1e", true: "#7cc940" }}
                thumbColor="#ffffff"
              />
            }
          />
        </SettingsSection>

        {/* Backup */}
        <SettingsSection title="Backup">
          <SettingsRow
            label="Show Recovery Phrase"
            onPress={handleShowRecovery}
          />
        </SettingsSection>

        {/* Masternode */}
        <SettingsSection title="Masternode">
          <SettingsRow
            label="Masternode Management"
            onPress={handleMasternode}
          />
        </SettingsSection>

        {/* Advanced */}
        <SettingsSection title="Advanced">
          <SettingsRow
            label="Connected Peers"
            value={String(connectedPeers)}
          />
          <SettingsRow
            label="Chain Height"
            value={chainHeight > 0 ? chainHeight.toLocaleString() : "--"}
          />
          <SettingsRow
            label="Resync Wallet"
            onPress={handleResync}
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingsRow label="Version" value={APP_VERSION} />
          <SettingsRow label="Network" value="FairCoin" />
          <SettingsRow label="Coin Type" value="119 (BIP44)" />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Danger Zone">
          <SettingsRow
            label="Wipe Wallet"
            onPress={handleWipePress}
            destructive
          />
        </SettingsSection>

        {/* Wipe confirmation modal */}
        <Modal
          visible={showWipeModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancelWipe}
        >
          <View className="flex-1 bg-black/70 items-center justify-center px-8">
            <View className="bg-fair-dark-light border border-fair-border rounded-2xl p-6 w-full max-w-sm">
              <Text className="text-white text-lg font-bold mb-2 text-center">
                Wipe Wallet?
              </Text>
              <Text className="text-fair-muted text-sm mb-6 text-center">
                This will permanently delete all wallets from this device. Make
                sure you have your recovery phrases backed up. This action cannot
                be undone.
              </Text>
              <View className="gap-3">
                <Button
                  title="Wipe All Wallets"
                  onPress={handleConfirmWipe}
                  variant="danger"
                />
                <Button
                  title="Cancel"
                  onPress={handleCancelWipe}
                  variant="secondary"
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* PIN verification modal */}
        <PinModal
          visible={showPinModal}
          title={
            pinAction === "recovery"
              ? "Verify PIN"
              : "Enter Current PIN"
          }
          onCancel={handlePinCancel}
          onSuccess={handlePinSuccess}
        />

        {/* Recovery phrase display modal */}
        <RecoveryModal
          visible={showRecoveryModal}
          mnemonic={recoveryMnemonic}
          onDismiss={handleRecoveryDismiss}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
