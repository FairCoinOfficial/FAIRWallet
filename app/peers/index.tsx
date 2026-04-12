/**
 * Network Peers screen — shows connected peers, network stats, and DNS seeds.
 * "Add Peer" navigates to a dedicated subscreen.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useWalletStore, getDatabase } from "../../src/wallet/wallet-store";
import type { PeerRow } from "../../src/storage/database";
import {
  Section,
  ListItem,
  Card,
  Badge,
  EmptyState,
} from "../../src/ui/components";
import { Button } from "../../src/ui/components/Button";

const DNS_SEEDS = [
  { host: "seed1.fairco.in", port: 46372 },
  { host: "seed2.fairco.in", port: 46372 },
] as const;

function getServiceLabels(services: number): string[] {
  const labels: string[] = [];
  if (services & 1) labels.push("NODE_NETWORK");
  if (services & 2) labels.push("NODE_GETUTXO");
  if (services & 4) labels.push("NODE_BLOOM");
  if (services & 8) labels.push("NODE_WITNESS");
  if (labels.length === 0) labels.push("NONE");
  return labels;
}

function formatLastSeen(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PeersScreen() {
  const router = useRouter();
  const connectedPeers = useWalletStore((s) => s.connectedPeers);
  const chainHeight = useWalletStore((s) => s.chainHeight);
  const isSyncing = useWalletStore((s) => s.isSyncing);
  const syncProgress = useWalletStore((s) => s.syncProgress);
  const network = useWalletStore((s) => s.network);

  const [peers, setPeers] = useState<PeerRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      const db = getDatabase();
      if (db) {
        db.getKnownPeers(100).then(setPeers);
      }
    }, []),
  );

  const syncStatus = useMemo(() => {
    if (connectedPeers === 0) return { text: "Offline", variant: "error" as const };
    if (isSyncing) return { text: `Syncing ${Math.round(syncProgress)}%`, variant: "warning" as const };
    return { text: "Synced", variant: "success" as const };
  }, [connectedPeers, isSyncing, syncProgress]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-5 pt-4 pb-8"
    >
      {/* Stats */}
      <Card className="p-4 mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-muted-foreground text-sm">Status</Text>
          <Badge text={syncStatus.text} variant={syncStatus.variant} />
        </View>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-muted-foreground text-sm">Connected</Text>
          <Text className="text-foreground text-sm font-semibold">
            {connectedPeers} {connectedPeers === 1 ? "peer" : "peers"}
          </Text>
        </View>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-muted-foreground text-sm">Block Height</Text>
          <Text className="text-foreground text-sm font-semibold">
            {chainHeight > 0 ? chainHeight.toLocaleString() : "—"}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-muted-foreground text-sm">Network</Text>
          <Badge
            text={network === "testnet" ? "Testnet" : "Mainnet"}
            variant={network === "testnet" ? "warning" : "info"}
          />
        </View>
      </Card>

      {/* Peers list */}
      <Section title="Known Peers" className="mb-6">
        {peers.length === 0 ? (
          <EmptyState
            icon="server-network-off"
            title="No peers yet"
            subtitle="Peers will appear once the wallet connects to the network"
          />
        ) : (
          peers.map((peer, idx) => (
            <ListItem
              key={`${peer.host}:${peer.port}`}
              icon="server-network"
              title={`${peer.host}:${peer.port}`}
              subtitle={getServiceLabels(peer.services).join(", ")}
              value={formatLastSeen(peer.last_seen)}
              isLast={idx === peers.length - 1}
              showChevron={false}
            />
          ))
        )}
      </Section>

      {/* Add peer button */}
      <View className="mb-6">
        <Button
          title="Add Peer Manually"
          onPress={() => router.push("/peers/add")}
          variant="outline"
          icon={null}
        />
      </View>

      {/* DNS Seeds */}
      <Section title="DNS Seeds">
        {DNS_SEEDS.map((seed, idx) => (
          <ListItem
            key={seed.host}
            icon="dns"
            title={seed.host}
            subtitle={`Port ${seed.port}`}
            isLast={idx === DNS_SEEDS.length - 1}
            showChevron={false}
          />
        ))}
      </Section>
    </ScrollView>
  );
}
