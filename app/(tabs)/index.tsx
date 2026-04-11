/**
 * Home screen — Revolut-inspired balance + activity feed.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useWalletStore } from "../../src/wallet/wallet-store";
import { TransactionItem } from "../../src/ui/components/TransactionItem";
import {
  startPricePolling,
  stopPricePolling,
  getCachedPrice,
  type PriceData,
} from "../../src/services/price";

// ---------------------------------------------------------------------------
// Helpers (pure functions, outside component)
// ---------------------------------------------------------------------------

function formatBalance(sats: bigint): string {
  const whole = sats / 100_000_000n;
  const frac = sats % 100_000_000n;
  const fracStr = frac.toString().padStart(8, "0");
  return `${whole.toString()}.${fracStr}`;
}

function formatFiat(sats: bigint, rate: number): string {
  const fair = Number(sats) / 100_000_000;
  return (fair * rate).toFixed(2);
}

function formatChange(change: number | null): {
  text: string;
  positive: boolean;
} | null {
  if (change === null) return null;
  const sign = change >= 0 ? "+" : "";
  return {
    text: `${sign}${change.toFixed(1)}%`,
    positive: change >= 0,
  };
}

// ---------------------------------------------------------------------------
// Quick action button
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  onPress: () => void;
}

function ActionButton({ icon, label, onPress }: ActionButtonProps) {
  return (
    <Pressable
      className="items-center active:opacity-70"
      onPress={onPress}
    >
      <View className="w-14 h-14 rounded-full bg-fair-green/10 items-center justify-center mb-2">
        <MaterialCommunityIcons name={icon} size={24} color="#9ffb50" />
      </View>
      <Text className="text-white text-xs font-medium">{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Home screen
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

  const displayBalance = formatBalance(balance);
  const usdValue = price ? formatFiat(balance, price.usd) : null;
  const change = price ? formatChange(price.change24h) : null;
  const recentTransactions = transactions.slice(0, 10);

  // Sync status
  const syncInfo = useMemo(() => {
    if (connectedPeers === 0) return { dot: "bg-red-400", text: "Offline" };
    if (isSyncing) return { dot: "bg-yellow-400", text: `Syncing ${Math.round(syncProgress)}%` };
    return { dot: "bg-fair-green", text: "Synced" };
  }, [connectedPeers, isSyncing, syncProgress]);

  return (
    <View className="flex-1 bg-fair-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        contentContainerStyle={{ paddingTop: insets.top }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor="#9ffb50"
          />
        }
      >
        {/* ---- Header: Wallet name + sync indicator ---- */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
          <Pressable
            className="flex-row items-center active:opacity-70"
            onPress={() => router.push("/wallets")}
          >
            <Text className="text-white text-base font-semibold mr-1">
              {activeWalletName || "FAIRWallet"}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={18}
              color="#6b7280"
            />
          </Pressable>

          <View className="flex-row items-center">
            {network === "testnet" ? (
              <View className="bg-yellow-600/20 rounded-full px-2 py-0.5 mr-2">
                <Text className="text-yellow-400 text-[10px] font-bold">
                  TESTNET
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center">
              <View className={`w-2 h-2 rounded-full ${syncInfo.dot} mr-1.5`} />
              <Text className="text-fair-muted text-xs">{syncInfo.text}</Text>
            </View>
          </View>
        </View>

        {/* ---- Balance hero ---- */}
        <View className="items-center px-6 pt-6 pb-2">
          {/* Fiat value (large) */}
          {usdValue !== null ? (
            <Text className="text-white text-5xl font-bold tracking-tight">
              ${usdValue}
            </Text>
          ) : (
            <Text className="text-white text-5xl font-bold tracking-tight">
              {displayBalance}
            </Text>
          )}

          {/* FAIR amount or fiat subtitle */}
          {usdValue !== null ? (
            <Text className="text-fair-muted text-base mt-2">
              {displayBalance} FAIR
            </Text>
          ) : (
            <Text className="text-fair-green text-lg mt-1">FAIR</Text>
          )}

          {/* 24h change pill */}
          {change ? (
            <View
              className={`mt-3 px-3 py-1 rounded-full ${
                change.positive ? "bg-green-500/15" : "bg-red-500/15"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  change.positive ? "text-green-400" : "text-red-400"
                }`}
              >
                {change.text} today
              </Text>
            </View>
          ) : null}
        </View>

        {/* ---- Quick actions ---- */}
        <View className="flex-row justify-center gap-8 px-6 pt-6 pb-4">
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
            icon="contacts"
            label="Contacts"
            onPress={() => router.push("/contacts")}
          />
          <ActionButton
            icon="server"
            label="Masternode"
            onPress={() => router.push("/masternode")}
          />
        </View>

        {/* ---- Sync progress bar (only when syncing) ---- */}
        {isSyncing ? (
          <View className="mx-6 mb-4">
            <View className="h-1 bg-fair-dark-light rounded-full overflow-hidden">
              <View
                className="h-full bg-fair-green rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, syncProgress))}%` }}
              />
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-fair-muted text-[10px]">
                {connectedPeers} {connectedPeers === 1 ? "peer" : "peers"}
              </Text>
              <Text className="text-fair-muted text-[10px]">
                Block #{chainHeight.toLocaleString()}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ---- Divider ---- */}
        <View className="h-px bg-fair-border mx-6 mb-4" />

        {/* ---- Activity feed ---- */}
        <View className="px-4">
          <View className="flex-row items-center justify-between px-2 mb-3">
            <Text className="text-white text-lg font-semibold">
              Activity
            </Text>
            {recentTransactions.length > 0 ? (
              <Text className="text-fair-muted text-xs">
                {transactions.length} total
              </Text>
            ) : null}
          </View>

          {recentTransactions.length === 0 ? (
            <View className="items-center py-12">
              <View className="w-16 h-16 rounded-full bg-fair-dark-light items-center justify-center mb-4">
                <MaterialCommunityIcons
                  name="swap-vertical"
                  size={28}
                  color="#6b7280"
                />
              </View>
              <Text className="text-fair-muted text-sm font-medium">
                No transactions yet
              </Text>
              <Text className="text-fair-muted/60 text-xs mt-1 text-center px-12">
                Send or receive FAIR to see your activity here
              </Text>
            </View>
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
