/**
 * Coin control screen.
 * Shows all UTXOs and lets users select specific ones for the next transaction.
 * Presented as a modal from settings or the send screen.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useWalletStore, getDatabase } from "../src/wallet/wallet-store";
import {
  Section,
  ListItem,
  Card,
  Button,
  EmptyState,
  ScreenHeader,
} from "../src/ui/components";
import { ScrollView } from "react-native";
import { useColorScheme } from "../src/theme/useColorScheme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UTXOItem {
  txid: string;
  vout: number;
  address: string;
  value: bigint;
  blockHeight: number;
  confirmations: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateTxid(txid: string): string {
  if (txid.length <= 16) return txid;
  return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
}

function formatSats(sats: bigint): string {
  const abs = sats < 0n ? -sats : sats;
  const whole = abs / 100_000_000n;
  const frac = abs % 100_000_000n;
  return `${whole.toString()}.${frac.toString().padStart(8, "0")}`;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CoinControlScreen() {
  const router = useRouter();
  const chainHeight = useWalletStore((s) => s.chainHeight);
  const existingSelection = useWalletStore((s) => s.selectedUTXOs);
  const setSelectedUTXOs = useWalletStore((s) => s.setSelectedUTXOs);
  const clearSelectedUTXOs = useWalletStore((s) => s.clearSelectedUTXOs);
  const { colors } = useColorScheme();

  const [utxos, setUtxos] = useState<UTXOItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Map<string, boolean>>(() => {
    const map = new Map<string, boolean>();
    for (const utxo of existingSelection) {
      map.set(`${utxo.txid}:${utxo.vout}`, true);
    }
    return map;
  });

  // Load UTXOs on layout (similar to useFocusEffect without useEffect)
  const handleLayout = useCallback(() => {
    if (loaded) return;
    const db = getDatabase();
    if (!db) return;

    db.getUnspentUTXOs().then((rows) => {
      const items: UTXOItem[] = rows.map((row) => ({
        txid: row.txid,
        vout: row.vout,
        address: row.address,
        value: BigInt(row.value),
        blockHeight: row.block_height,
        confirmations:
          chainHeight > 0 && row.block_height > 0
            ? chainHeight - row.block_height + 1
            : 0,
      }));
      setUtxos(items);
      setLoaded(true);
    });
  }, [loaded, chainHeight]);

  const handleToggle = useCallback((txid: string, vout: number) => {
    const key = `${txid}:${vout}`;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, true);
      }
      return next;
    });
  }, []);

  const selectedCount = selected.size;

  const selectedTotal = useMemo(() => {
    let total = 0n;
    for (const utxo of utxos) {
      const key = `${utxo.txid}:${utxo.vout}`;
      if (selected.has(key)) {
        total += utxo.value;
      }
    }
    return total;
  }, [utxos, selected]);

  const handleApply = useCallback(() => {
    const selectedUtxos: Array<{ txid: string; vout: number }> = [];
    for (const utxo of utxos) {
      const key = `${utxo.txid}:${utxo.vout}`;
      if (selected.has(key)) {
        selectedUtxos.push({ txid: utxo.txid, vout: utxo.vout });
      }
    }
    setSelectedUTXOs(selectedUtxos);
    Alert.alert(
      "Coin Control",
      `${selectedUtxos.length} UTXO${selectedUtxos.length !== 1 ? "s" : ""} selected for next transaction.`,
    );
    router.back();
  }, [utxos, selected, setSelectedUTXOs, router]);

  const handleClear = useCallback(() => {
    setSelected(new Map());
    clearSelectedUTXOs();
  }, [clearSelectedUTXOs]);

  const handleSelectAll = useCallback(() => {
    const next = new Map<string, boolean>();
    for (const utxo of utxos) {
      next.set(`${utxo.txid}:${utxo.vout}`, true);
    }
    setSelected(next);
  }, [utxos]);

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
      onLayout={handleLayout}
    >
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-4">
        {/* Header info */}
        <ScreenHeader
          title="Coin Control"
          subtitle={`${utxos.length} UTXO${utxos.length !== 1 ? "s" : ""} available`}
        />

        {/* Selection actions */}
        <View className="flex-row gap-3 mb-4">
          <Pressable
            className="bg-surface border border-border rounded-lg px-3 py-1.5"
            onPress={handleSelectAll}
          >
            <Text className="text-primary text-xs">Select All</Text>
          </Pressable>
          <Pressable
            className="bg-surface border border-border rounded-lg px-3 py-1.5"
            onPress={handleClear}
          >
            <Text className="text-muted-foreground text-xs">Clear</Text>
          </Pressable>
        </View>

        {/* UTXO list */}
        <Section title="Unspent Outputs" className="mb-4">
          {utxos.length === 0 ? (
            <EmptyState
              icon="database-off"
              title="No unspent outputs"
              subtitle="No UTXOs found in this wallet"
            />
          ) : (
            utxos.map((utxo, idx) => {
              const key = `${utxo.txid}:${utxo.vout}`;
              const isSelected = selected.has(key);
              return (
                <ListItem
                  key={`utxo-${idx}-${key}`}
                  title={`${truncateTxid(utxo.txid)}:${utxo.vout}`}
                  subtitle={`${utxo.address.slice(0, 12)}...`}
                  value={`${formatSats(utxo.value)} FAIR`}
                  isLast={idx === utxos.length - 1}
                  onPress={() => handleToggle(utxo.txid, utxo.vout)}
                  showChevron={false}
                  trailing={
                    <View
                      className={`w-5 h-5 rounded border items-center justify-center ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "bg-transparent border-muted-foreground"
                      }`}
                    >
                      {isSelected ? (
                         <MaterialCommunityIcons
                          name="check"
                          size={14}
                          color={colors.background}
                        />
                      ) : null}
                    </View>
                  }
                />
              );
            })
          )}
        </Section>

        {/* Selection summary */}
        {selectedCount > 0 ? (
          <Card className="p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-muted-foreground text-sm">
                Selected: {selectedCount} UTXO
                {selectedCount !== 1 ? "s" : ""}
              </Text>
              <Text className="text-primary text-sm font-semibold">
                {formatSats(selectedTotal)} FAIR
              </Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {/* Bottom action bar */}
      <View className="px-5 py-4 border-t border-border">
        <Button
          title={
            selectedCount > 0
              ? `Use ${selectedCount} UTXO${selectedCount !== 1 ? "s" : ""} for Next Transaction`
              : "Select UTXOs"
          }
          onPress={handleApply}
          variant="primary"
          disabled={selectedCount === 0}
        />
      </View>
    </SafeAreaView>
  );
}
