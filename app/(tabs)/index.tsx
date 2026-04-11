/**
 * Home / Balance screen.
 * Displays balance, sync status, and recent transactions.
 */

import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useWalletStore } from "../../src/wallet/wallet-store";
import { SyncStatus } from "../../src/ui/components/SyncStatus";
import { TransactionItem } from "../../src/ui/components/TransactionItem";
import {
  startPricePolling,
  stopPricePolling,
  getCachedPrice,
  type PriceData,
} from "../../src/services/price";
import { t } from "../../src/i18n";

/** Format satoshis (bigint) to FAIR display string */
function formatBalance(sats: bigint): string {
  const whole = sats / 100_000_000n;
  const frac = sats % 100_000_000n;
  const fracStr = frac.toString().padStart(8, "0");
  return `${whole.toString()}.${fracStr}`;
}

/** Format a FAIR amount (from bigint sats) to a fiat value string */
function formatFiat(sats: bigint, rate: number): string {
  const fair = Number(sats) / 100_000_000;
  return (fair * rate).toFixed(2);
}

/** Format 24h change percentage with sign and color class */
function formatChange(change: number | null): {
  text: string;
  colorClass: string;
} {
  if (change === null) {
    return { text: "", colorClass: "text-fair-muted" };
  }
  const sign = change >= 0 ? "+" : "";
  const text = `${sign}${change.toFixed(1)}%`;
  const colorClass = change >= 0 ? "text-green-400" : "text-red-400";
  return { text, colorClass };
}

export default function HomeScreen() {
  const balance = useWalletStore((s) => s.balance);
  const isSyncing = useWalletStore((s) => s.isSyncing);
  const syncProgress = useWalletStore((s) => s.syncProgress);
  const connectedPeers = useWalletStore((s) => s.connectedPeers);
  const chainHeight = useWalletStore((s) => s.chainHeight);
  const networkStatus = useWalletStore((s) => s.networkStatus);
  const transactions = useWalletStore((s) => s.transactions);
  const network = useWalletStore((s) => s.network);
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const loading = useWalletStore((s) => s.loading);

  const [price, setPrice] = useState<PriceData | null>(getCachedPrice);

  const displayBalance = formatBalance(balance);

  // Start/stop price polling when tab is focused
  useFocusEffect(
    useCallback(() => {
      startPricePolling((updated) => {
        setPrice(updated);
      });
      return () => {
        stopPricePolling();
      };
    }, []),
  );

  const handleRefresh = useCallback(() => {
    refreshBalance();
  }, [refreshBalance]);

  const recentTransactions = transactions.slice(0, 5);

  const usdValue = price ? formatFiat(balance, price.usd) : null;
  const change = price ? formatChange(price.change24h) : null;

  return (
    <SafeAreaView className="flex-1 bg-fair-dark" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor="#9ffb50"
          />
        }
      >
        {/* Network badge */}
        {network === "testnet" ? (
          <View className="items-center pt-2">
            <View className="bg-yellow-600/20 border border-yellow-600/50 rounded-full px-3 py-1">
              <Text className="text-yellow-400 text-xs font-medium">
                TESTNET
              </Text>
            </View>
          </View>
        ) : null}

        {/* Balance */}
        <View className="items-center px-6 pt-8 pb-6">
          <Text className="text-fair-muted text-sm mb-2">{t("wallet.balance")}</Text>
          <Text className="text-white text-4xl font-bold tracking-tight">
            {displayBalance}
          </Text>
          <Text className="text-fair-green text-lg mt-1">FAIR</Text>

          {/* USD equivalent and 24h change */}
          {usdValue !== null ? (
            <View className="flex-row items-center mt-2 gap-2">
              <Text className="text-fair-muted text-sm">
                {"\u2248"} ${usdValue} USD
              </Text>
              {change?.text ? (
                <Text className={`text-sm font-medium ${change.colorClass}`}>
                  {change.text}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Sync status */}
        <View className="px-4 mb-6">
          <SyncStatus
            progress={syncProgress}
            isSyncing={isSyncing}
            connectedPeers={connectedPeers}
            chainHeight={chainHeight}
            networkStatus={networkStatus}
          />
        </View>

        {/* Recent transactions */}
        <View className="px-4">
          <Text className="text-white text-base font-semibold mb-3">
            Recent Transactions
          </Text>

          {recentTransactions.length === 0 ? (
            <View className="bg-fair-dark-light rounded-xl p-6 items-center">
              <Text className="text-fair-muted text-sm">
                No transactions yet
              </Text>
              <Text className="text-fair-muted text-xs mt-1">
                Send or receive FAIR to see activity here
              </Text>
            </View>
          ) : (
            <View className="bg-fair-dark-light rounded-xl overflow-hidden">
              {recentTransactions.map((tx) => (
                <TransactionItem
                  key={tx.txid}
                  txid={tx.txid}
                  type={tx.type}
                  amount={formatBalance(tx.amount < 0n ? -tx.amount : tx.amount)}
                  address={tx.address}
                  timestamp={tx.timestamp}
                  confirmations={tx.confirmations}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
