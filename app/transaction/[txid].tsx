/**
 * Transaction detail screen.
 * Shows full details for a single transaction with editable notes.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {
  useWalletStore,
  getDatabase,
  type WalletTransaction,
} from "../../src/wallet/wallet-store";
import { useContactsStore } from "../../src/wallet/contacts-store";
import { Button } from "../../src/ui/components/Button";
import type { ContactRow } from "../../src/storage/database";

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
  bgClass: string;
  textClass: string;
}

const TYPE_BADGE: Record<TransactionType, TypeBadgeConfig> = {
  send: {
    label: "Sent",
    bgClass: "bg-red-900/30 border-red-600/50",
    textClass: "text-red-400",
  },
  receive: {
    label: "Received",
    bgClass: "bg-green-900/30 border-green-600/50",
    textClass: "text-fair-green",
  },
  stake: {
    label: "Stake",
    bgClass: "bg-yellow-900/30 border-yellow-600/50",
    textClass: "text-yellow-400",
  },
  masternode_reward: {
    label: "Masternode Reward",
    bgClass: "bg-green-900/30 border-green-600/50",
    textClass: "text-fair-green",
  },
};

// ---------------------------------------------------------------------------
// Detail row component
// ---------------------------------------------------------------------------

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
  onCopy?: string;
}

function DetailRow({
  label,
  value,
  mono = false,
  valueColor = "text-white",
  onCopy,
}: DetailRowProps) {
  const handleCopy = useCallback(() => {
    if (onCopy) {
      Clipboard.setStringAsync(onCopy);
      Alert.alert("Copied", "Copied to clipboard");
    }
  }, [onCopy]);

  return (
    <View className="flex-row items-start justify-between py-3 border-b border-fair-border">
      <Text className="text-fair-muted text-sm flex-shrink-0 mr-4">
        {label}
      </Text>
      <View className="flex-row items-center flex-shrink">
        <Text
          className={`text-sm ${valueColor} ${mono ? "font-mono" : ""} text-right flex-shrink`}
          numberOfLines={mono ? 1 : undefined}
          ellipsizeMode="middle"
        >
          {value}
        </Text>
        {onCopy ? (
          <Pressable onPress={handleCopy} className="ml-2 p-1">
            <Text className="text-fair-green text-xs">Copy</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TransactionDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { txid } = useLocalSearchParams<{ txid: string }>();
  const transactions = useWalletStore((s) => s.transactions);
  const chainHeight = useWalletStore((s) => s.chainHeight);

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

  const handleAddToContacts = useCallback(() => {
    router.push("/contacts");
  }, [router]);

  if (!transaction) {
    return (
      <View className="flex-1 bg-fair-dark" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-fair-muted text-base text-center">
            Transaction not found
          </Text>
          <View className="mt-4">
            <Button
              title="Go Back"
              onPress={() => router.back()}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    );
  }

  const badgeConfig = TYPE_BADGE[transaction.type];
  const isPositive = transaction.amount >= 0n;
  const amountSign = isPositive ? "+" : "-";
  const amountDisplay = formatSats(transaction.amount);
  const amountColor = isPositive ? "text-fair-green" : "text-red-400";
  const isConfirmed = transaction.confirmations >= 6;
  const statusText = isConfirmed ? "Confirmed" : "Pending";
  const statusColor = isConfirmed ? "text-fair-green" : "text-yellow-400";

  return (
    <View
      className="flex-1 bg-fair-dark"
      onLayout={handleLayout}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-4 pb-8"
        contentContainerStyle={{ paddingTop: insets.top }}
      >
        {/* Type badge */}
        <View className="items-center mb-4">
          <View className={`border rounded-full px-4 py-1.5 ${badgeConfig.bgClass}`}>
            <Text className={`text-sm font-semibold ${badgeConfig.textClass}`}>
              {badgeConfig.label}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View className="items-center mb-6">
          <Text className={`text-3xl font-bold ${amountColor}`}>
            {amountSign}{amountDisplay}
          </Text>
          <Text className="text-fair-muted text-base mt-1">FAIR</Text>
        </View>

        {/* Details card */}
        <View className="bg-fair-dark-light rounded-xl px-4 mb-6">
          <DetailRow
            label="Status"
            value={`${statusText} (${transaction.confirmations} confirmations)`}
            valueColor={statusColor}
          />
          <DetailRow
            label="Date"
            value={formatTimestamp(transaction.timestamp)}
          />
          <DetailRow
            label="Address"
            value={
              contact
                ? `${contact.emoji} ${contact.name} (${truncateAddress(transaction.address)})`
                : truncateAddress(transaction.address)
            }
            onCopy={transaction.address}
          />
          <DetailRow
            label="Transaction ID"
            value={txid ?? ""}
            mono
            onCopy={txid}
          />
          {transaction.type === "send" ? (
            <DetailRow label="Fee" value="Included in total" />
          ) : null}
        </View>

        {/* Transaction note */}
        <View className="mb-6">
          <Text className="text-white text-sm font-medium mb-2">
            Transaction Note
          </Text>
          <View className="bg-fair-dark-light border border-fair-border rounded-xl p-3 mb-3">
            <TextInput
              className="text-white text-sm"
              placeholder="Add a note for this transaction..."
              placeholderTextColor="#6b7280"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
          </View>
          <Button
            title="Save Note"
            onPress={handleSaveNote}
            variant="secondary"
            size="sm"
          />
        </View>

        {/* Add to contacts (if not already saved) */}
        {!contact && contactChecked ? (
          <View className="mb-6">
            <Button
              title="Add Address to Contacts"
              onPress={handleAddToContacts}
              variant="outline"
            />
          </View>
        ) : null}

        {/* View on explorer */}
        <View className="mb-6">
          <Button
            title="View on Explorer"
            onPress={handleViewExplorer}
            variant="secondary"
          />
        </View>

        {/* Copy transaction ID */}
        <View className="mb-4">
          <Button
            title="Copy Transaction ID"
            onPress={handleCopyTxid}
            variant="ghost"
            size="sm"
          />
        </View>
      </ScrollView>
    </View>
  );
}
