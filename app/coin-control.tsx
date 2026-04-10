/**
 * Coin control screen.
 * Shows all UTXOs and lets users select specific ones for the next transaction.
 * Presented as a modal from settings or the send screen.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useWalletStore, getDatabase } from "../src/wallet/wallet-store";
import { Button } from "../src/ui/components/Button";

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
// UTXO row component
// ---------------------------------------------------------------------------

interface UTXORowProps {
  utxo: UTXOItem;
  selected: boolean;
  onToggle: (txid: string, vout: number) => void;
}

function UTXORow({ utxo, selected, onToggle }: UTXORowProps) {
  const handlePress = useCallback(() => {
    onToggle(utxo.txid, utxo.vout);
  }, [utxo.txid, utxo.vout, onToggle]);

  return (
    <Pressable
      className={`px-4 py-3.5 border-b border-fair-border ${
        selected ? "bg-fair-green/10" : ""
      }`}
      onPress={handlePress}
    >
      <View className="flex-row items-center">
        {/* Checkbox */}
        <View
          className={`w-5 h-5 rounded border mr-3 items-center justify-center ${
            selected
              ? "bg-fair-green border-fair-green"
              : "bg-transparent border-fair-muted"
          }`}
        >
          {selected ? (
            <Text className="text-fair-dark text-xs font-bold">
              {"\u2713"}
            </Text>
          ) : null}
        </View>

        {/* Details */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-white text-xs font-mono">
              {truncateTxid(utxo.txid)}:{utxo.vout}
            </Text>
            <Text className="text-fair-green text-sm font-semibold">
              {formatSats(utxo.value)} FAIR
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-fair-muted text-xs">
              {utxo.address.slice(0, 12)}...
            </Text>
            <Text className="text-fair-muted text-xs">
              {utxo.confirmations > 0
                ? `${utxo.confirmations} conf.`
                : "Unconfirmed"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
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
      className="flex-1 bg-fair-dark"
      edges={["top", "bottom", "left", "right"]}
      onLayout={handleLayout}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
      >
        {/* Header info */}
        <View className="px-6 pt-4 pb-2">
          <Text className="text-fair-muted text-sm">
            {utxos.length} UTXO{utxos.length !== 1 ? "s" : ""} available
          </Text>
          {selectedCount > 0 ? (
            <Text className="text-fair-green text-xs mt-1">
              {selectedCount} selected = {formatSats(selectedTotal)} FAIR
            </Text>
          ) : null}
        </View>

        {/* Selection actions */}
        <View className="flex-row px-6 gap-3 mb-4">
          <Pressable
            className="bg-fair-dark-light border border-fair-border rounded-lg px-3 py-1.5"
            onPress={handleSelectAll}
          >
            <Text className="text-fair-green text-xs">Select All</Text>
          </Pressable>
          <Pressable
            className="bg-fair-dark-light border border-fair-border rounded-lg px-3 py-1.5"
            onPress={handleClear}
          >
            <Text className="text-fair-muted text-xs">Clear</Text>
          </Pressable>
        </View>

        {/* UTXO list */}
        {utxos.length === 0 ? (
          <View className="px-6">
            <View className="bg-fair-dark-light rounded-xl p-6 items-center">
              <Text className="text-fair-muted text-sm text-center">
                No unspent outputs found.
              </Text>
            </View>
          </View>
        ) : (
          <View className="mx-4 bg-fair-dark-light rounded-xl overflow-hidden">
            {utxos.map((utxo, idx) => {
              const key = `${utxo.txid}:${utxo.vout}`;
              return (
                <UTXORow
                  key={`utxo-${idx}-${key}`}
                  utxo={utxo}
                  selected={selected.has(key)}
                  onToggle={handleToggle}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View className="px-6 py-4 border-t border-fair-border">
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
