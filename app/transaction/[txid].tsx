/**
 * Transaction detail screen.
 * Shows full details for a single transaction with editable notes.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  useWalletStore,
  getDatabase,
  type WalletTransaction,
} from "../../src/wallet/wallet-store";
import {
  Section,
  ListItem,
  Card,
  Button,
  Badge,
  EmptyState,
  ScreenHeader,
} from "../../src/ui/components";
import type { ContactRow } from "../../src/storage/database";
import { useTheme } from "@oxyhq/bloom/theme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSats(sats: bigint): string {
  const abs = sats < 0n ? -sats : sats;
  const whole = abs / 100_000_000n;
  const frac = abs % 100_000_000n;
  return `${whole.toString()}.${frac.toString().padStart(8, "0")}`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}...${address.slice(-10)}`;
}

type TransactionType = "send" | "receive" | "stake" | "masternode_reward";

interface TypeBadgeConfig {
  label: string;
  variant: "success" | "warning" | "error" | "info";
}

const TYPE_BADGE: Record<TransactionType, TypeBadgeConfig> = {
  send: { label: "Sent", variant: "error" },
  receive: { label: "Received", variant: "success" },
  stake: { label: "Stake", variant: "warning" },
  masternode_reward: { label: "Masternode Reward", variant: "success" },
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { txid } = useLocalSearchParams<{ txid: string }>();
  const transactions = useWalletStore((s) => s.transactions);
  const chainHeight = useWalletStore((s) => s.chainHeight);
  const theme = useTheme();

  const [note, setNote] = useState("");
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [contact, setContact] = useState<ContactRow | null>(null);
  const [contactChecked, setContactChecked] = useState(false);

  const transaction = useMemo<WalletTransaction | undefined>(
    () => transactions.find((tx) => tx.txid === txid),
    [transactions, txid],
  );

  // Load note and contact info on layout
  const handleLayout = useCallback(() => {
    if (!txid) return;

    const db = getDatabase();
    if (db && !noteLoaded) {
      db.getTxNote(txid).then((savedNote) => {
        if (savedNote) {
          setNote(savedNote);
        }
        setNoteLoaded(true);
      });
    }

    if (db && transaction && !contactChecked) {
      db.getContactByAddress(transaction.address).then((c) => {
        setContact(c);
        setContactChecked(true);
      });
    }
  }, [txid, noteLoaded, transaction, contactChecked]);

  const handleSaveNote = useCallback(() => {
    if (!txid) return;
    const db = getDatabase();
    if (db) {
      db.setTxNote(txid, note.trim());
      Alert.alert("Saved", "Transaction note saved");
    }
  }, [txid, note]);

  const handleViewExplorer = useCallback(() => {
    if (!txid) return;
    Linking.openURL(`https://explorer.fairco.in/tx/${txid}`);
  }, [txid]);

  const handleCopyTxid = useCallback(() => {
    if (!txid) return;
    Clipboard.setStringAsync(txid);
    Alert.alert("Copied", "Transaction ID copied to clipboard");
  }, [txid]);

  const handleCopyAddress = useCallback(() => {
    if (!transaction) return;
    Clipboard.setStringAsync(transaction.address);
    Alert.alert("Copied", "Address copied to clipboard");
  }, [transaction]);

  const handleAddToContacts = useCallback(() => {
    router.push("/contacts");
  }, [router]);

  if (!transaction) {
    return (
      <SafeAreaView
        className="flex-1 bg-background"
        edges={["top", "bottom", "left", "right"]}
      >
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="file-find"
            title="Transaction not found"
            subtitle="This transaction could not be loaded"
          />
          <View className="mt-4">
            <Button
              title="Go Back"
              onPress={() => router.back()}
              variant="secondary"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const badgeConfig = TYPE_BADGE[transaction.type];
  const isPositive = transaction.amount >= 0n;
  const amountSign = isPositive ? "+" : "-";
  const amountDisplay = formatSats(transaction.amount);
  const amountColor = isPositive ? "text-primary" : "text-red-400";
  const isConfirmed = transaction.confirmations >= 6;

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
      onLayout={handleLayout}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8"
      >
        {/* Type badge */}
        <View className="items-center mb-4">
          <Badge
            text={badgeConfig.label}
            variant={badgeConfig.variant}
            size="md"
          />
        </View>

        {/* Amount */}
        <View className="items-center mb-6">
          <Text className={`text-3xl font-bold ${amountColor}`}>
            {amountSign}
            {amountDisplay}
          </Text>
          <Text className="text-muted-foreground text-base mt-1">FAIR</Text>
        </View>

        {/* Details */}
        <Section title="Details" className="mb-6">
          <ListItem
            icon="check-circle"
            iconBg={isConfirmed ? "bg-green-500/15" : "bg-yellow-500/15"}
            iconColor={isConfirmed ? theme.colors.success : theme.colors.warning}
            title="Status"
            value={`${isConfirmed ? "Confirmed" : "Pending"} (${transaction.confirmations})`}
            isLast={false}
          />
          <ListItem
            icon="identifier"
            title="Transaction ID"
            subtitle={txid ?? ""}
            onPress={handleCopyTxid}
            isLast={false}
          />
          <ListItem
            icon="clock-outline"
            title="Date"
            value={formatTimestamp(transaction.timestamp)}
            isLast={false}
          />
          {transaction.type === "send" ? (
            <ListItem
              icon="currency-usd"
              title="Fee"
              value="Included in total"
              isLast={false}
            />
          ) : null}
          <ListItem
            icon="map-marker"
            title="Address"
            subtitle={
              contact
                ? `${contact.emoji} ${contact.name} (${truncateAddress(transaction.address)})`
                : truncateAddress(transaction.address)
            }
            onPress={handleCopyAddress}
            isLast
          />
        </Section>

        {/* Transaction note */}
        <Section title="Note" className="mb-6">
          <Card className="p-3">
            <TextInput
              className="text-white text-sm"
              placeholder="Add a note for this transaction..."
              placeholderTextColor={theme.colors.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </Card>
          <View className="mt-3">
            <Button
              title="Save Note"
              onPress={handleSaveNote}
              variant="secondary"
              size="sm"
            />
          </View>
        </Section>

        {/* Actions */}
        <View className="gap-3">
          <Button
            title="View on Explorer"
            onPress={handleViewExplorer}
            variant="secondary"
            icon={
              <MaterialCommunityIcons
                name="open-in-new"
                size={18}
                color={theme.colors.text}
              />
            }
          />
          <Button
            title="Copy Transaction ID"
            onPress={handleCopyTxid}
            variant="ghost"
            size="sm"
            icon={
              <MaterialCommunityIcons
                name="content-copy"
                size={16}
                color={theme.colors.primary}
              />
            }
          />
          {!contact && contactChecked ? (
            <Button
              title="Add Address to Contacts"
              onPress={handleAddToContacts}
              variant="outline"
              icon={
                <MaterialCommunityIcons
                  name="account-plus"
                  size={18}
                  color={theme.colors.primary}
                />
              }
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
