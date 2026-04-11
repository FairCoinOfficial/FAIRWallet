/**
 * Home screen — balance, quick actions, and activity feed.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useWalletStore } from "../../src/wallet/wallet-store";
import {
  BalanceDisplay,
  ActionButton,
  Divider,
  EmptyState,
  Badge,
} from "../../src/ui/components";
import { TransactionItem } from "../../src/ui/components/TransactionItem";
import {
  startPricePolling,
  stopPricePolling,
  getCachedPrice,
  type PriceData,
} from "../../src/services/price";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBalance(sats: bigint): string {
  const whole = sats / 100_000_000n;
  const frac = sats % 100_000_000n;
  const fracStr = frac.toString().padStart(8, "0");
  return `${whole.toString()}.${fracStr}`;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const balance = useWalletStore((s) => s.balance);
  const isSyncing = useWalletStore((s) => s.isSyncing);
  const syncProgress = useWalletStore((s) => s.syncProgress);
  const connectedPeers = useWalletStore((s) => s.connectedPeers);
  const chainHeight = useWalletStore((s) => s.chainHeight);
  const transactions = useWalletStore((s) => s.transactions);
  const network = useWalletStore((s) => s.network);
  const activeWalletName = useWalletStore((s) => s.activeWalletName);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const loading = useWalletStore((s) => s.loading);

  const [price, setPrice] = useState<PriceData | null>(getCachedPrice);

  useFocusEffect(
    useCallback(() => {
      startPricePolling((updated) => setPrice(updated));
      return () => stopPricePolling();
    }, []),
  );

  const handleRefresh = useCallback(() => {
    refreshBalance();
  }, [refreshBalance]);

  const recentTransactions = transactions.slice(0, 10);

  const syncState = useMemo(() => {
    if (connectedPeers === 0) return { dot: "bg-red-400", label: "Offline" };
    if (isSyncing) return { dot: "bg-yellow-400", label: `Syncing ${Math.round(syncProgress)}%` };
    return { dot: "bg-fair-green", label: "Synced" };
  }, [connectedPeers, isSyncing, syncProgress]);

  return (
    <View className="flex-1 bg-fair-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-6"
        contentContainerStyle={{ paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor="#9ffb50"
          />
        }
      >
        {/* ---- Top bar ---- */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-1">
          {/* Wallet name (tappable → wallet switcher) */}
          <Pressable
            className="flex-row items-center active:opacity-60"
            onPress={() => router.push("/wallets")}
          >
            <Text className="text-white text-base font-semibold">
              {activeWalletName || "FAIRWallet"}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={18}
              color="#6b7280"
            />
          </Pressable>

          {/* Right: network badge + sync status (tappable → peers) */}
          <View className="flex-row items-center gap-2">
            {network === "testnet" ? (
              <Badge text="TESTNET" variant="warning" size="sm" />
            ) : null}
            <Pressable
              className="flex-row items-center active:opacity-60"
              onPress={() => router.push("/peers")}
            >
              <View className={`w-1.5 h-1.5 rounded-full ${syncState.dot} mr-1`} />
              <Text className="text-fair-muted text-[11px]">{syncState.label}</Text>
            </Pressable>
          </View>
        </View>

        {/* ---- Balance ---- */}
        <View className="items-center pt-8 pb-6 px-6">
          <BalanceDisplay
            sats={balance}
            priceUsd={price?.usd}
            change24h={price?.change24h}
            size="lg"
          />
        </View>

        {/* ---- Quick actions ---- */}
        <View className="flex-row justify-evenly px-4 pb-6">
          <ActionButton
            icon="arrow-up-bold"
            label="Send"
            onPress={() => router.push("/(tabs)/send")}
          />
          <ActionButton
            icon="arrow-down-bold"
            label="Receive"
            onPress={() => router.push("/(tabs)/receive")}
          />
          <ActionButton
            icon="account-group"
            label="Contacts"
            onPress={() => router.push("/contacts")}
          />
          <ActionButton
            icon="server-network"
            label="Nodes"
            onPress={() => router.push("/masternode")}
          />
        </View>

        {/* ---- Sync progress (only visible while syncing) ---- */}
        {isSyncing ? (
          <View className="mx-5 mb-4">
            <View className="h-0.5 bg-fair-border rounded-full overflow-hidden">
              <View
                className="h-full bg-fair-green rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, syncProgress))}%` }}
              />
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-fair-muted text-[10px]">
                {connectedPeers} {connectedPeers === 1 ? "peer" : "peers"}
              </Text>
              {chainHeight > 0 ? (
                <Text className="text-fair-muted text-[10px]">
                  Block {chainHeight.toLocaleString()}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ---- Activity ---- */}
        <View className="px-5">
          <Divider className="mb-5" />

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-semibold">Activity</Text>
            {transactions.length > 0 ? (
              <Text className="text-fair-muted text-xs">
                {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
              </Text>
            ) : null}
          </View>

          {recentTransactions.length === 0 ? (
            <EmptyState
              icon="swap-vertical"
              title="No activity yet"
              subtitle="Your transactions will appear here"
            />
          ) : (
            <View className="bg-fair-dark-light rounded-2xl overflow-hidden">
              {recentTransactions.map((tx, idx) => (
                <View key={tx.txid}>
                  <TransactionItem
                    txid={tx.txid}
                    type={tx.type}
                    amount={formatBalance(
                      tx.amount < 0n ? -tx.amount : tx.amount,
                    )}
                    address={tx.address}
                    timestamp={tx.timestamp}
                    confirmations={tx.confirmations}
                  />
                  {idx < recentTransactions.length - 1 ? (
                    <View className="h-px bg-fair-border ml-16" />
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
