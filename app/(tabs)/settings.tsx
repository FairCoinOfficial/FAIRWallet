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
import { Card, Button, PinDots, PinPad, ScreenHeader } from "../../src/ui/components";
import type { NetworkType } from "../../src/core/network";
import { useBloomTheme } from "@oxyhq/bloom/theme";
import type { ThemeMode } from "@oxyhq/bloom/theme";
import * as Prompt from "@oxyhq/bloom/prompt";
import {
  SettingsListGroup,
  SettingsListItem,
} from "@oxyhq/bloom/settings-list";

const APP_VERSION = "1.0.0";
const PIN_LENGTH = 6;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// ---------------------------------------------------------------------------
// Settings row icon — colored circular badge used as the `icon` slot of
// Bloom's SettingsListItem.
// ---------------------------------------------------------------------------

interface SettingsRowIconProps {
  name: IconName;
  color: string;
  bgClassName: string;
}

function SettingsRowIcon({ name, color, bgClassName }: SettingsRowIconProps) {
  return (
    <View
      className={`w-9 h-9 rounded-full items-center justify-center ${bgClassName}`}
    >
      <MaterialCommunityIcons name={name} size={20} color={color} />
    </View>
  );
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
        <Card className="p-6 w-full max-w-sm border border-border">
          <Text className="text-foreground text-lg font-bold mb-2 text-center">
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
  control: Prompt.PromptControlProps;
  mnemonic: string;
  onDismiss: () => void;
}

function RecoveryModal({ control, mnemonic, onDismiss }: RecoveryModalProps) {
  const words = useMemo(() => mnemonic.split(" "), [mnemonic]);

  return (
    <Prompt.Outer control={control} onClose={onDismiss}>
      <Prompt.Content>
        <Prompt.TitleText>Recovery Phrase</Prompt.TitleText>
        <Prompt.DescriptionText>
          Keep these words safe and never share them.
        </Prompt.DescriptionText>
        <View className="flex-row flex-wrap justify-center gap-2 mt-2">
          {words.map((word, idx) => (
            <View
              key={`recovery-word-${idx}`}
              className="bg-background rounded-lg px-3 py-1.5"
            >
              <Text className="text-foreground text-sm">
                <Text className="text-muted-foreground">{idx + 1}. </Text>
                {word}
              </Text>
            </View>
          ))}
        </View>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action cta="Done" onPress={onDismiss} color="primary" />
      </Prompt.Actions>
    </Prompt.Outer>
  );
}

// ---------------------------------------------------------------------------
// Theme color preset picker
// ---------------------------------------------------------------------------

function AppearancePicker() {
  const { theme, mode, setMode } = useBloomTheme();

  const modes: Array<{ value: ThemeMode; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"] }> = [
    { value: "light", label: "Light", icon: "white-balance-sunny" },
    { value: "dark", label: "Dark", icon: "moon-waning-crescent" },
    { value: "system", label: "System", icon: "cellphone" },
  ];

  return (
    <View className="px-4 py-3">
      <Text className="text-muted-foreground text-xs mb-2">Appearance</Text>
      <View className="flex-row gap-2">
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
                name={m.icon}
                size={16}
                color={isActive ? theme.colors.tint : theme.colors.textSecondary}
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

  const wipeControl = Prompt.usePromptControl();
  const switchNetworkControl = Prompt.usePromptControl();
  const resyncControl = Prompt.usePromptControl();
  const recoveryControl = Prompt.usePromptControl();
  const messageControl = Prompt.usePromptControl();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<"recovery" | "change_pin" | null>(
    null,
  );
  const [recoveryMnemonic, setRecoveryMnemonic] = useState("");
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [messageDialog, setMessageDialog] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const showMessage = useCallback(
    (title: string, description: string) => {
      setMessageDialog({ title, description });
      messageControl.open();
    },
    [messageControl],
  );

  const handleMessageDismiss = useCallback(() => {
    setMessageDialog(null);
  }, []);

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
    switchNetworkControl.open();
  }, [switchNetworkControl]);

  const handleConfirmSwitchNetwork = useCallback(() => {
    const targetNetwork: NetworkType = isMainnet ? "testnet" : "mainnet";
    switchNetwork(targetNetwork);
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
          recoveryControl.open();
        } else {
          showMessage("Error", "Could not retrieve recovery phrase.");
        }
      } catch {
        showMessage("Error", "Failed to load recovery phrase.");
      }
    } else if (action === "change_pin") {
      router.push("/onboarding/pin-setup");
    }
  }, [pinAction, router, recoveryControl, showMessage]);

  const handleRecoveryDismiss = useCallback(() => {
    setRecoveryMnemonic("");
  }, []);

  const handleToggleBiometrics = useCallback(
    async (enabled: boolean) => {
      if (enabled && !biometricsAvailable) {
        showMessage(
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
        showMessage("Error", "Failed to update biometrics setting.");
      }
    },
    [biometricsAvailable, showMessage],
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
      showMessage(
        "Backup Exported",
        "Backup data copied to clipboard. Save it in a secure location.",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      showMessage("Error", message);
    }
  }, [exportBackup, showMessage]);

  const handleImportBackup = useCallback(async () => {
    try {
      const { getStringAsync } = await import("expo-clipboard");
      const json = await getStringAsync();
      if (!json || json.trim().length === 0) {
        showMessage(
          "Error",
          "No backup data found in clipboard. Copy backup JSON to clipboard first.",
        );
        return;
      }
      await importBackup(json);
      showMessage(
        "Backup Imported",
        "Contacts, labels, and settings have been restored.",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      showMessage("Error", message);
    }
  }, [importBackup, showMessage]);

  const handleResync = useCallback(() => {
    resyncControl.open();
  }, [resyncControl]);

  const handleConfirmResync = useCallback(() => {
    refreshBalance();
  }, [refreshBalance]);

  const handleConfirmWipe = useCallback(async () => {
    await wipeWallet();
    router.replace("/onboarding/welcome");
  }, [wipeWallet, router]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Settings" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pt-2 pb-8 gap-2"
      >
        {/* Wallets */}
        <SettingsListGroup title="Wallets">
          <SettingsListItem
            title="Manage Wallets"
            value={walletCountLabel}
            icon={
              <SettingsRowIcon
                name="wallet"
                color="#60a5fa"
                bgClassName="bg-blue-500/10"
              />
            }
            onPress={handleManageWallets}
          />
          <SettingsListItem
            title="Contacts"
            icon={
              <SettingsRowIcon
                name="account-group"
                color="#a78bfa"
                bgClassName="bg-purple-500/10"
              />
            }
            onPress={handleContacts}
          />
        </SettingsListGroup>

        {/* Security */}
        <SettingsListGroup title="Security">
          <SettingsListItem
            title="Change PIN"
            icon={
              <SettingsRowIcon
                name="lock"
                color="#facc15"
                bgClassName="bg-yellow-500/10"
              />
            }
            onPress={handleChangePIN}
          />
          <SettingsListItem
            title="Biometric Unlock"
            icon={
              <SettingsRowIcon
                name="fingerprint"
                color={themeColors.primary}
                bgClassName="bg-primary/10"
              />
            }
            rightElement={
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
          <SettingsListItem
            title="Auto-Lock"
            value={`${autoLockMinutes} min`}
            icon={
              <SettingsRowIcon
                name="clock-outline"
                color="#fb923c"
                bgClassName="bg-orange-500/10"
              />
            }
            onPress={handleCycleAutoLock}
          />
          <SettingsListItem
            title="Export Encrypted Key"
            icon={
              <SettingsRowIcon
                name="shield-key"
                color="#2dd4bf"
                bgClassName="bg-teal-500/10"
              />
            }
            onPress={handleExportKey}
          />
        </SettingsListGroup>

        {/* Appearance */}
        <SettingsListGroup title="Appearance">
          <SettingsListItem
            title="Display Currency"
            value={displayCurrency}
            icon={
              <SettingsRowIcon
                name="currency-usd"
                color={themeColors.primary}
                bgClassName="bg-primary/10"
              />
            }
            onPress={handleCycleCurrency}
          />
          <AppearancePicker />
        </SettingsListGroup>

        {/* Network */}
        <SettingsListGroup title="Network">
          <SettingsListItem
            title="Network"
            value={isMainnet ? "Mainnet" : "Testnet"}
            icon={
              <SettingsRowIcon
                name="earth"
                color="#22d3ee"
                bgClassName="bg-cyan-500/10"
              />
            }
            onPress={handleToggleNetwork}
          />
          <SettingsListItem
            title="Connected Peers"
            value={String(connectedPeers)}
            icon={
              <SettingsRowIcon
                name="server-network"
                color="#818cf8"
                bgClassName="bg-indigo-500/10"
              />
            }
            onPress={() => router.push("/peers")}
          />
          <SettingsListItem
            title="Resync Wallet"
            icon={
              <SettingsRowIcon
                name="sync"
                color="#38bdf8"
                bgClassName="bg-sky-500/10"
              />
            }
            onPress={handleResync}
          />
        </SettingsListGroup>

        {/* Backup */}
        <SettingsListGroup title="Backup">
          <SettingsListItem
            title="Show Recovery Phrase"
            icon={
              <SettingsRowIcon
                name="eye"
                color="#fbbf24"
                bgClassName="bg-amber-500/10"
              />
            }
            onPress={handleShowRecovery}
          />
          <SettingsListItem
            title="Export Backup"
            icon={
              <SettingsRowIcon
                name="download"
                color={themeColors.primary}
                bgClassName="bg-primary/10"
              />
            }
            onPress={handleExportBackup}
          />
          <SettingsListItem
            title="Import Backup"
            icon={
              <SettingsRowIcon
                name="upload"
                color="#8b5cf6"
                bgClassName="bg-violet-500/10"
              />
            }
            onPress={handleImportBackup}
          />
        </SettingsListGroup>

        {/* Advanced */}
        <SettingsListGroup title="Advanced">
          <SettingsListItem
            title="Coin Control"
            icon={
              <SettingsRowIcon
                name="tune"
                color="#94a3b8"
                bgClassName="bg-slate-500/10"
              />
            }
            onPress={handleCoinControl}
          />
          <SettingsListItem
            title="Masternode"
            icon={
              <SettingsRowIcon
                name="server"
                color="#fb7185"
                bgClassName="bg-rose-500/10"
              />
            }
            onPress={handleMasternode}
          />
        </SettingsListGroup>

        {/* About */}
        <SettingsListGroup title="About">
          <SettingsListItem
            title="About FAIRWallet"
            value={`v${APP_VERSION}`}
            icon={
              <SettingsRowIcon
                name="information"
                color="#60a5fa"
                bgClassName="bg-blue-500/10"
              />
            }
            showChevron={false}
          />
        </SettingsListGroup>

        {/* Danger Zone */}
        <SettingsListGroup title="Danger Zone">
          <SettingsListItem
            title="Wipe Wallet"
            icon={
              <SettingsRowIcon
                name="delete"
                color="#f87171"
                bgClassName="bg-red-500/10"
              />
            }
            destructive
            onPress={() => wipeControl.open()}
          />
        </SettingsListGroup>

        {/* PIN verification modal */}
        <PinModal
          visible={showPinModal}
          title={
            pinAction === "recovery" ? "Verify PIN" : "Enter Current PIN"
          }
          onCancel={handlePinCancel}
          onSuccess={handlePinSuccess}
        />
      </ScrollView>

      {/* Wipe confirmation prompt */}
      <Prompt.Basic
        control={wipeControl}
        title="Wipe Wallet?"
        description="This will permanently delete all wallets from this device. Make sure you have your recovery phrases backed up. This action cannot be undone."
        confirmButtonCta="Wipe All Wallets"
        confirmButtonColor="negative"
        onConfirm={handleConfirmWipe}
      />

      {/* Switch network prompt */}
      <Prompt.Basic
        control={switchNetworkControl}
        title="Switch Network"
        description={`Switch to ${isMainnet ? "testnet" : "mainnet"}? This will require a resync.`}
        confirmButtonCta="Switch"
        onConfirm={handleConfirmSwitchNetwork}
      />

      {/* Resync wallet prompt */}
      <Prompt.Basic
        control={resyncControl}
        title="Resync Wallet"
        description="This will re-download all blockchain data."
        confirmButtonCta="Resync"
        onConfirm={handleConfirmResync}
      />

      {/* Recovery phrase display prompt */}
      <RecoveryModal
        control={recoveryControl}
        mnemonic={recoveryMnemonic}
        onDismiss={handleRecoveryDismiss}
      />

      {/* Shared info/error message prompt */}
      <Prompt.Basic
        control={messageControl}
        title={messageDialog?.title ?? ""}
        description={messageDialog?.description ?? ""}
        confirmButtonCta="OK"
        onConfirm={handleMessageDismiss}
        showCancel={false}
      />
    </View>
  );
}
