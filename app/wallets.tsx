/**
 * Wallet manager screen.
 * Lists all wallets, allows switching, creating, importing, and deleting wallets.
 * Presented as a modal from the settings screen.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useWalletStore } from "../src/wallet/wallet-store";
import type { WalletInfo } from "../src/storage/secure-store";
import {
  Section,
  ListItem,
  Card,
  Button,
  Badge,
  EmptyState,
  ScreenHeader,
} from "../src/ui/components";
import { useTheme } from "@oxyhq/bloom/theme";
import * as Prompt from "@oxyhq/bloom/prompt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Import wallet modal
// ---------------------------------------------------------------------------

interface ImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onImport: (name: string, mnemonic: string) => void;
}

function ImportModal({ visible, onCancel, onImport }: ImportModalProps) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCancel = useCallback(() => {
    setName("");
    setMnemonic("");
    setError(null);
    onCancel();
  }, [onCancel]);

  const handleImport = useCallback(() => {
    const trimmedName = name.trim();
    const trimmedMnemonic = mnemonic.trim();

    if (!trimmedName) {
      setError("Please enter a wallet name.");
      return;
    }

    if (!trimmedMnemonic) {
      setError("Please enter the recovery phrase.");
      return;
    }

    const words = trimmedMnemonic.split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      setError("Recovery phrase must be 12 or 24 words.");
      return;
    }

    setError(null);
    setName("");
    setMnemonic("");
    onImport(trimmedName, trimmedMnemonic);
  }, [name, mnemonic, onImport]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-8">
        <Card className="p-6 w-full max-w-sm">
          <Text className="text-foreground text-lg font-bold mb-4 text-center">
            Import Wallet
          </Text>

          <Text className="text-muted-foreground text-xs mb-1">Wallet Name</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base mb-3"
            placeholder="My Wallet"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Text className="text-muted-foreground text-xs mb-1">Recovery Phrase</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base mb-3"
            placeholder="Enter 12 or 24 word recovery phrase"
            placeholderTextColor={theme.colors.textSecondary}
            value={mnemonic}
            onChangeText={setMnemonic}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {error ? (
            <Text className="text-red-400 text-xs mb-3 text-center">
              {error}
            </Text>
          ) : null}

          <View className="gap-3">
            <Button title="Import" onPress={handleImport} variant="primary" />
            <Button title="Cancel" onPress={handleCancel} variant="secondary" />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Watch-only wallet modal
// ---------------------------------------------------------------------------

interface WatchOnlyModalProps {
  visible: boolean;
  onCancel: () => void;
  onImport: (name: string, xpub: string) => void;
}

function WatchOnlyModal({ visible, onCancel, onImport }: WatchOnlyModalProps) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [xpub, setXpub] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCancel = useCallback(() => {
    setName("");
    setXpub("");
    setError(null);
    onCancel();
  }, [onCancel]);

  const handleImport = useCallback(() => {
    const trimmedName = name.trim();
    const trimmedXpub = xpub.trim();

    if (!trimmedName) {
      setError("Please enter a wallet name.");
      return;
    }

    if (!trimmedXpub) {
      setError("Please enter the extended public key (xpub).");
      return;
    }

    if (!trimmedXpub.startsWith("xpub") && !trimmedXpub.startsWith("tpub")) {
      setError("Extended public key must start with 'xpub' or 'tpub'.");
      return;
    }

    setError(null);
    setName("");
    setXpub("");
    onImport(trimmedName, trimmedXpub);
  }, [name, xpub, onImport]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-8">
        <Card className="p-6 w-full max-w-sm">
          <Text className="text-foreground text-lg font-bold mb-4 text-center">
            Watch-Only Wallet
          </Text>

          <Text className="text-muted-foreground text-xs mb-1">Wallet Name</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base mb-3"
            placeholder="My Watch Wallet"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Text className="text-muted-foreground text-xs mb-1">
            Extended Public Key (xpub)
          </Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base mb-3"
            placeholder="xpub..."
            placeholderTextColor={theme.colors.textSecondary}
            value={xpub}
            onChangeText={setXpub}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {error ? (
            <Text className="text-red-400 text-xs mb-3 text-center">
              {error}
            </Text>
          ) : null}

          <View className="gap-3">
            <Button
              title="Import Watch-Only"
              onPress={handleImport}
              variant="primary"
            />
            <Button title="Cancel" onPress={handleCancel} variant="secondary" />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create wallet modal
// ---------------------------------------------------------------------------

interface CreateModalProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}

function CreateModal({ visible, onCancel, onCreate }: CreateModalProps) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCancel = useCallback(() => {
    setName("");
    setError(null);
    onCancel();
  }, [onCancel]);

  const handleCreate = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a wallet name.");
      return;
    }

    setError(null);
    setName("");
    onCreate(trimmedName);
  }, [name, onCreate]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-8">
        <Card className="p-6 w-full max-w-sm">
          <Text className="text-foreground text-lg font-bold mb-4 text-center">
            Create New Wallet
          </Text>

          <Text className="text-muted-foreground text-xs mb-1">Wallet Name</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base mb-3"
            placeholder="My Wallet"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
          />

          {error ? (
            <Text className="text-red-400 text-xs mb-3 text-center">
              {error}
            </Text>
          ) : null}

          <View className="gap-3">
            <Button title="Create" onPress={handleCreate} variant="primary" />
            <Button title="Cancel" onPress={handleCancel} variant="secondary" />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Mnemonic display modal (shown after creating a new wallet)
// ---------------------------------------------------------------------------

interface MnemonicModalProps {
  control: Prompt.PromptControlProps;
  mnemonic: string;
  onDismiss: () => void;
}

function MnemonicModal({ control, mnemonic, onDismiss }: MnemonicModalProps) {
  const words = useMemo(() => mnemonic.split(" "), [mnemonic]);

  return (
    <Prompt.Outer control={control} onClose={onDismiss}>
      <Prompt.Content>
        <Prompt.TitleText>Recovery Phrase</Prompt.TitleText>
        <Prompt.DescriptionText>
          Write down these words in order. They are the only way to recover
          this wallet.
        </Prompt.DescriptionText>
        <View className="flex-row flex-wrap justify-center gap-2 mt-2">
          {words.map((word, idx) => (
            <View
              key={`word-${idx}`}
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
        <Prompt.Action
          cta="I've Written It Down"
          onPress={onDismiss}
          color="primary"
        />
      </Prompt.Actions>
    </Prompt.Outer>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function WalletsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const wallets = useWalletStore((s) => s.wallets);
  const activeWalletId = useWalletStore((s) => s.activeWalletId);
  const loading = useWalletStore((s) => s.loading);
  const loadWalletList = useWalletStore((s) => s.loadWalletList);
  const switchWallet = useWalletStore((s) => s.switchWallet);
  const createNewWallet = useWalletStore((s) => s.createNewWallet);
  const importWallet = useWalletStore((s) => s.importWallet);
  const importWatchOnly = useWalletStore((s) => s.importWatchOnly);
  const deleteWallet = useWalletStore((s) => s.deleteWallet);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showWatchOnlyModal, setShowWatchOnlyModal] = useState(false);
  const [newMnemonic, setNewMnemonic] = useState("");
  const [switching, setSwitching] = useState(false);
  const [pendingDeleteWallet, setPendingDeleteWallet] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [message, setMessage] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const mnemonicControl = Prompt.usePromptControl();
  const deleteWalletControl = Prompt.usePromptControl();
  const cannotDeleteControl = Prompt.usePromptControl();
  const messageControl = Prompt.usePromptControl();

  const showMessage = useCallback(
    (title: string, description: string) => {
      setMessage({ title, description });
      messageControl.open();
    },
    [messageControl],
  );

  // Load wallet list on focus
  useFocusEffect(
    useCallback(() => {
      loadWalletList();
    }, [loadWalletList]),
  );

  const handleSwitch = useCallback(
    async (walletId: string) => {
      setSwitching(true);
      await switchWallet(walletId);
      setSwitching(false);
      router.back();
    },
    [switchWallet, router],
  );

  const handleDelete = useCallback(
    (walletId: string, walletName: string) => {
      if (wallets.length <= 1) {
        cannotDeleteControl.open();
        return;
      }
      setPendingDeleteWallet({ id: walletId, name: walletName });
      deleteWalletControl.open();
    },
    [wallets.length, deleteWalletControl, cannotDeleteControl],
  );

  const handleCreateWallet = useCallback(
    async (name: string) => {
      setShowCreateModal(false);
      try {
        const mnemonic = await createNewWallet(name);
        setNewMnemonic(mnemonic);
        mnemonicControl.open();
      } catch {
        showMessage("Error", "Failed to create wallet. Please try again.");
      }
    },
    [createNewWallet, mnemonicControl, showMessage],
  );

  const handleImportWallet = useCallback(
    async (name: string, mnemonic: string) => {
      setShowImportModal(false);
      try {
        await importWallet(name, mnemonic);
        router.back();
      } catch {
        showMessage(
          "Import Failed",
          "Could not import wallet. Check your recovery phrase and try again.",
        );
      }
    },
    [importWallet, router, showMessage],
  );

  const handleMnemonicDismiss = useCallback(() => {
    mnemonicControl.close();
    setNewMnemonic("");
  }, [mnemonicControl]);

  const handleOpenCreate = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleOpenImport = useCallback(() => {
    setShowImportModal(true);
  }, []);

  const handleCloseImport = useCallback(() => {
    setShowImportModal(false);
  }, []);

  const handleOpenWatchOnly = useCallback(() => {
    setShowWatchOnlyModal(true);
  }, []);

  const handleCloseWatchOnly = useCallback(() => {
    setShowWatchOnlyModal(false);
  }, []);

  const handleImportWatchOnly = useCallback(
    async (name: string, xpub: string) => {
      setShowWatchOnlyModal(false);
      try {
        await importWatchOnly(name, xpub);
        showMessage(
          "Watch-Only Wallet",
          "Watch-only wallet imported. You can view balances and addresses, but sending is disabled.",
        );
      } catch {
        showMessage(
          "Import Failed",
          "Could not import watch-only wallet. Check your xpub and try again.",
        );
      }
    },
    [importWatchOnly, showMessage],
  );

  if (switching || loading) {
    return (
      <SafeAreaView
        className="flex-1 bg-background items-center justify-center"
        edges={["top", "bottom", "left", "right"]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text className="text-muted-foreground text-sm mt-4">
          {switching ? "Switching wallet..." : "Loading..."}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
    >
      <ScreenHeader
        title="Wallets"
        subtitle={`${wallets.length} wallet${wallets.length !== 1 ? "s" : ""} - Tap to switch, long-press to delete`}
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8"
      >
        {/* Wallet list */}
        <Section className="mb-6">
          {wallets.length === 0 ? (
            <EmptyState
              icon="wallet"
              title="No wallets found"
              subtitle="Create or import one below"
            />
          ) : (
            wallets.map((wallet, idx) => {
              const isActive = wallet.id === activeWalletId;
              return (
                <ListItem
                  key={wallet.id}
                  icon="wallet"
                  iconBg={isActive ? "bg-green-500/15" : "bg-primary/10"}
                  iconColor={isActive ? theme.colors.success : theme.colors.tint}
                  title={wallet.name}
                  subtitle={`Created ${formatDate(wallet.createdAt)}`}
                  isLast={idx === wallets.length - 1}
                  onPress={() => {
                    if (!isActive) handleSwitch(wallet.id);
                  }}
                  trailing={
                    isActive ? (
                      <Badge text="Active" variant="success" />
                    ) : undefined
                  }
                />
              );
            })
          )}
        </Section>

        {/* Action buttons */}
        <View className="gap-3">
          <Button
            title="Create New Wallet"
            onPress={handleOpenCreate}
            variant="primary"
          />
          <Button
            title="Import Wallet"
            onPress={handleOpenImport}
            variant="outline"
          />
          <Button
            title="Watch Only (xpub)"
            onPress={handleOpenWatchOnly}
            variant="outline"
          />
        </View>
      </ScrollView>

      {/* Modals */}
      <CreateModal
        visible={showCreateModal}
        onCancel={handleCloseCreate}
        onCreate={handleCreateWallet}
      />
      <ImportModal
        visible={showImportModal}
        onCancel={handleCloseImport}
        onImport={handleImportWallet}
      />
      <WatchOnlyModal
        visible={showWatchOnlyModal}
        onCancel={handleCloseWatchOnly}
        onImport={handleImportWatchOnly}
      />
      <MnemonicModal
        control={mnemonicControl}
        mnemonic={newMnemonic}
        onDismiss={handleMnemonicDismiss}
      />

      <Prompt.Basic
        control={deleteWalletControl}
        title="Delete Wallet"
        description={
          pendingDeleteWallet
            ? `Are you sure you want to delete "${pendingDeleteWallet.name}"? This action cannot be undone. Make sure you have the recovery phrase backed up.`
            : ""
        }
        confirmButtonCta="Delete"
        confirmButtonColor="negative"
        onConfirm={async () => {
          if (pendingDeleteWallet) {
            await deleteWallet(pendingDeleteWallet.id);
            setPendingDeleteWallet(null);
          }
        }}
      />

      <Prompt.Outer control={cannotDeleteControl}>
        <Prompt.Content>
          <Prompt.TitleText>Cannot Delete</Prompt.TitleText>
          <Prompt.DescriptionText>
            You must have at least one wallet. Create a new wallet before
            deleting this one.
          </Prompt.DescriptionText>
        </Prompt.Content>
        <Prompt.Actions>
          <Prompt.Action
            cta="OK"
            onPress={() => cannotDeleteControl.close()}
            color="primary"
          />
        </Prompt.Actions>
      </Prompt.Outer>

      <Prompt.Basic
        control={messageControl}
        title={message?.title ?? ""}
        description={message?.description ?? ""}
        confirmButtonCta="OK"
        onConfirm={() => setMessage(null)}
        showCancel={false}
      />
    </SafeAreaView>
  );
}
