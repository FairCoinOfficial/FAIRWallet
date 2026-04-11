/**
 * Settings screen.
 * Network, wallets, security, backup, masternode, advanced, about, and danger zone.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  Modal,
  Alert,
  Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useWalletStore } from "../../src/wallet/wallet-store";
import {
  verifyPin,
  isBiometricsEnabled,
  setBiometricsEnabled as storeBiometricsEnabled,
  getMnemonic,
  getAutoLockTimeout,
  setAutoLockTimeout,
  getCurrency,
  setCurrency,
} from "../../src/storage/secure-store";
import {
  Section,
  ListItem,
  Card,
  Button,
  PinDots,
  PinPad,
} from "../../src/ui/components";
import type { NetworkType } from "../../src/core/network";
import { useBloomTheme, APP_COLOR_NAMES, APP_COLOR_PRESETS } from "@oxyhq/bloom";
import type { ThemeMode, AppColorName } from "@oxyhq/bloom";

const APP_VERSION = "1.0.0";
const PIN_LENGTH = 6;

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
        <Card className="p-6 w-full max-w-sm border border-border">
          <Text className="text-white text-lg font-bold mb-2 text-center">
            {title}
          </Text>
          <Text className="text-muted-foreground text-sm mb-4 text-center">
            Enter your 6-digit PIN
          </Text>

          <View className="items-center mb-4">
            <PinDots
              length={PIN_LENGTH}
              filled={pin.length}
              error={error !== null}
            />
          </View>

          {error ? (
            <Text className="text-red-400 text-xs text-center mb-3">
              {error}
            </Text>
          ) : null}

          <View className="items-center mb-4">
            <PinPad
              onDigit={handleDigitPress}
              onBackspace={handleBackspace}
              disabled={verifying}
            />
          </View>

          <Button title="Cancel" onPress={handleCancel} variant="secondary" />
        </Card>
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
        <Card className="p-6 w-full max-w-sm border border-border">
          <Text className="text-white text-lg font-bold mb-2 text-center">
            Recovery Phrase
          </Text>
          <Text className="text-muted-foreground text-xs mb-4 text-center">
            Keep these words safe and never share them.
          </Text>

          <View className="flex-row flex-wrap justify-center gap-2 mb-4">
            {words.map((word, idx) => (
              <View
                key={`recovery-word-${idx}`}
                className="bg-background rounded-lg px-3 py-1.5"
              >
                <Text className="text-white text-sm">
                  <Text className="text-muted-foreground">{idx + 1}. </Text>
                  {word}
                </Text>
              </View>
            ))}
          </View>

          <Button title="Done" onPress={onDismiss} variant="primary" />
        </Card>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Theme color preset picker
// ---------------------------------------------------------------------------

function AppearancePicker() {
  const { theme, mode, colorPreset, setMode, setColorPreset } = useBloomTheme();

  const modes: Array<{ value: ThemeMode; label: string; icon: string }> = [
    { value: "light", label: "Light", icon: "white-balance-sunny" },
    { value: "dark", label: "Dark", icon: "moon-waning-crescent" },
    { value: "system", label: "System", icon: "cellphone" },
  ];

  return (
    <View className="px-4 py-3">
      {/* Mode picker */}
      <Text className="text-muted-foreground text-xs mb-2">Appearance</Text>
      <View className="flex-row gap-2 mb-4">
        {modes.map((m) => {
          const isActive = mode === m.value;
          return (
            <Pressable
              key={m.value}
              onPress={() => setMode(m.value)}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${
                isActive
                  ? "bg-primary/15 border border-primary/30"
                  : "bg-surface border border-border"
              }`}
            >
              <MaterialCommunityIcons
                name={m.icon as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
                size={16}
                color={isActive ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text
                className={`text-xs ml-1.5 font-medium ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Color preset picker */}
      <Text className="text-muted-foreground text-xs mb-2">Accent Color</Text>
      <View className="flex-row gap-3">
        {APP_COLOR_NAMES.map((name) => {
          const preset = APP_COLOR_PRESETS[name];
          const isActive = name === colorPreset;
          return (
            <Pressable
              key={name}
              onPress={() => setColorPreset(name)}
              className="items-center"
            >
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isActive ? "border-2 border-foreground" : "border border-border"
                }`}
                style={{ backgroundColor: preset.hex }}
              />
              <Text
                className={`text-xs mt-1 ${
                  isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                }`}
              >
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main settings screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme: { colors: themeColors } } = useBloomTheme();
  const network = useWalletStore((s) => s.network);
  const connectedPeers = useWalletStore((s) => s.connectedPeers);
  const wipeWallet = useWalletStore((s) => s.wipeWallet);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const activeWalletName = useWalletStore((s) => s.activeWalletName);
  const wallets = useWalletStore((s) => s.wallets);
  const switchNetwork = useWalletStore((s) => s.switchNetwork);
  const exportBackup = useWalletStore((s) => s.exportBackup);
  const importBackup = useWalletStore((s) => s.importBackup);

  const [showWipeModal, setShowWipeModal] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<"recovery" | "change_pin" | null>(
    null,
  );
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryMnemonic, setRecoveryMnemonic] = useState("");
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const [displayCurrency, setDisplayCurrency] = useState("USD");

  const isMainnet = network === "mainnet";

  // Load biometrics state and preferences on focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const loadSettings = async () => {
        try {
          const [hardwareAvailable, enrolled, enabled, lockTimeout, currency] =
            await Promise.all([
              LocalAuthentication.hasHardwareAsync(),
              LocalAuthentication.isEnrolledAsync(),
              isBiometricsEnabled(),
              getAutoLockTimeout(),
              getCurrency(),
            ]);

          if (cancelled) return;

          setBiometricsAvailable(hardwareAvailable && enrolled);
          setBiometricsEnabled(enabled && hardwareAvailable && enrolled);
          setAutoLockMinutes(lockTimeout);
          setDisplayCurrency(currency);
        } catch (_settingsError: unknown) {
          // Settings load failed — defaults from useState initializers are safe.
        }
      };
      loadSettings();
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

  const handleContacts = useCallback(() => {
    router.push("/contacts");
  }, [router]);

  const handleToggleNetwork = useCallback(() => {
    const targetNetwork: NetworkType = isMainnet ? "testnet" : "mainnet";
    Alert.alert(
      "Switch Network",
      `Switch to ${isMainnet ? "testnet" : "mainnet"}? This will require a resync.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: () => {
            switchNetwork(targetNetwork);
          },
        },
      ],
    );
  }, [isMainnet, switchNetwork]);

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

  const handleExportKey = useCallback(() => {
    router.push("/export-key");
  }, [router]);

  const handleCoinControl = useCallback(() => {
    router.push("/coin-control");
  }, [router]);

  const handleCycleCurrency = useCallback(async () => {
    const currencies = ["USD", "EUR", "BTC"];
    const currentIdx = currencies.indexOf(displayCurrency);
    const nextIdx = (currentIdx + 1) % currencies.length;
    const nextCurrency = currencies[nextIdx];
    setDisplayCurrency(nextCurrency);
    await setCurrency(nextCurrency);
  }, [displayCurrency]);

  const handleCycleAutoLock = useCallback(async () => {
    const options = [1, 5, 15, 30];
    const currentIdx = options.indexOf(autoLockMinutes);
    const nextIdx = (currentIdx + 1) % options.length;
    const nextMinutes = options[nextIdx];
    setAutoLockMinutes(nextMinutes);
    await setAutoLockTimeout(nextMinutes);
  }, [autoLockMinutes]);

  const handleExportBackup = useCallback(async () => {
    try {
      const json = await exportBackup();
      const { setStringAsync } = await import("expo-clipboard");
      await setStringAsync(json);
      Alert.alert(
        "Backup Exported",
        "Backup data copied to clipboard. Save it in a secure location.",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      Alert.alert("Error", message);
    }
  }, [exportBackup]);

  const handleImportBackup = useCallback(async () => {
    try {
      const { getStringAsync } = await import("expo-clipboard");
      const json = await getStringAsync();
      if (!json || json.trim().length === 0) {
        Alert.alert(
          "Error",
          "No backup data found in clipboard. Copy backup JSON to clipboard first.",
        );
        return;
      }
      await importBackup(json);
      Alert.alert(
        "Backup Imported",
        "Contacts, labels, and settings have been restored.",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      Alert.alert("Error", message);
    }
  }, [importBackup]);

  const handleResync = useCallback(() => {
    Alert.alert(
      "Resync Wallet",
      "This will re-download all blockchain data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resync",
          onPress: () => refreshBalance(),
        },
      ],
    );
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
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-8 gap-6"
        contentContainerStyle={{ paddingTop: insets.top }}
      >
        {/* Wallets */}
        <Section title="Wallets">
          <ListItem
            title="Manage Wallets"
            value={walletCountLabel}
            icon="wallet"
            iconBg="bg-blue-500/10"
            iconColor="#60a5fa"
            onPress={handleManageWallets}
          />
          <ListItem
            title="Contacts"
            icon="account-group"
            iconBg="bg-purple-500/10"
            iconColor="#a78bfa"
            onPress={handleContacts}
            isLast
          />
        </Section>

        {/* Security */}
        <Section title="Security">
          <ListItem
            title="Change PIN"
            icon="lock"
            iconBg="bg-yellow-500/10"
            iconColor="#facc15"
            onPress={handleChangePIN}
          />
          <ListItem
            title="Biometric Unlock"
            icon="fingerprint"
            iconBg="bg-primary/10"
            iconColor={themeColors.primary}
            trailing={
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{
                  false: themeColors.border,
                  true: themeColors.primaryLight,
                }}
                thumbColor={themeColors.text}
              />
            }
            showChevron={false}
          />
          <ListItem
            title="Auto-Lock"
            value={`${autoLockMinutes} min`}
            icon="clock-outline"
            iconBg="bg-orange-500/10"
            iconColor="#fb923c"
            onPress={handleCycleAutoLock}
          />
          <ListItem
            title="Export Encrypted Key"
            icon="shield-key"
            iconBg="bg-teal-500/10"
            iconColor="#2dd4bf"
            onPress={handleExportKey}
            isLast
          />
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <ListItem
            title="Display Currency"
            value={displayCurrency}
            icon="currency-usd"
            iconBg="bg-emerald-500/10"
            iconColor="#34d399"
            onPress={handleCycleCurrency}
          />
          <AppearancePicker />
        </Section>

        {/* Network */}
        <Section title="Network">
          <ListItem
            title="Network"
            value={isMainnet ? "Mainnet" : "Testnet"}
            icon="earth"
            iconBg="bg-cyan-500/10"
            iconColor="#22d3ee"
            onPress={handleToggleNetwork}
          />
          <ListItem
            title="Connected Peers"
            value={String(connectedPeers)}
            icon="server-network"
            iconBg="bg-indigo-500/10"
            iconColor="#818cf8"
            showChevron={false}
          />
          <ListItem
            title="Resync Wallet"
            icon="sync"
            iconBg="bg-sky-500/10"
            iconColor="#38bdf8"
            onPress={handleResync}
            isLast
          />
        </Section>

        {/* Backup */}
        <Section title="Backup">
          <ListItem
            title="Show Recovery Phrase"
            icon="eye"
            iconBg="bg-amber-500/10"
            iconColor="#fbbf24"
            onPress={handleShowRecovery}
          />
          <ListItem
            title="Export Backup"
            icon="download"
            iconBg="bg-primary/10"
            iconColor={themeColors.primary}
            onPress={handleExportBackup}
          />
          <ListItem
            title="Import Backup"
            icon="upload"
            iconBg="bg-violet-500/10"
            iconColor="#8b5cf6"
            onPress={handleImportBackup}
            isLast
          />
        </Section>

        {/* Advanced */}
        <Section title="Advanced">
          <ListItem
            title="Coin Control"
            icon="tune"
            iconBg="bg-slate-500/10"
            iconColor="#94a3b8"
            onPress={handleCoinControl}
          />
          <ListItem
            title="Masternode"
            icon="server"
            iconBg="bg-rose-500/10"
            iconColor="#fb7185"
            onPress={handleMasternode}
            isLast
          />
        </Section>

        {/* About */}
        <Section title="About">
          <ListItem
            title="About FAIRWallet"
            value={`v${APP_VERSION}`}
            icon="information"
            iconBg="bg-blue-500/10"
            iconColor="#60a5fa"
            isLast
          />
        </Section>

        {/* Danger Zone */}
        <Section title="Danger Zone">
          <ListItem
            title="Wipe Wallet"
            icon="delete"
            iconBg="bg-red-500/10"
            iconColor="#f87171"
            destructive
            onPress={handleWipePress}
            isLast
          />
        </Section>

        {/* Wipe confirmation modal */}
        <Modal
          visible={showWipeModal}
          transparent
          animationType="fade"
          onRequestClose={handleCancelWipe}
        >
          <View className="flex-1 bg-black/70 items-center justify-center px-8">
            <Card className="p-6 w-full max-w-sm border border-border">
              <Text className="text-white text-lg font-bold mb-2 text-center">
                Wipe Wallet?
              </Text>
              <Text className="text-muted-foreground text-sm mb-6 text-center">
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
            </Card>
          </View>
        </Modal>

        {/* PIN verification modal */}
        <PinModal
          visible={showPinModal}
          title={
            pinAction === "recovery" ? "Verify PIN" : "Enter Current PIN"
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
    </View>
  );
}
