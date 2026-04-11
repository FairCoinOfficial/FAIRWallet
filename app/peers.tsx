/**
 * Network Peers screen.
 * Shows connected P2P peers, network stats, and allows adding new peers.
 * Reads peer data from the database peers table.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useWalletStore, getDatabase } from "../src/wallet/wallet-store";
import type { PeerRow } from "../src/storage/database";
import {
  Section,
  ListItem,
  Card,
  Button,
  Badge,
  EmptyState,
  ScreenHeader,
} from "../src/ui/components";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DNS_SEEDS = [
  { host: "seed1.fairco.in", port: 46372 },
  { host: "seed2.fairco.in", port: 46372 },
] as const;

const DEFAULT_PORT = "46372";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map service flags to human-readable labels */
function getServiceLabels(services: number): string[] {
  const labels: string[] = [];
  if (services & 1) labels.push("NODE_NETWORK");
  if (services & 2) labels.push("NODE_GETUTXO");
  if (services & 4) labels.push("NODE_BLOOM");
  if (services & 8) labels.push("NODE_WITNESS");
  if (services & 1024) labels.push("NODE_NETWORK_LIMITED");
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

function isValidIPv4(ip: string): boolean {
  const octets = ip.split(".");
  if (octets.length !== 4) return false;
  for (const octet of octets) {
    const num = Number(octet);
    if (
      !Number.isFinite(num) ||
      num < 0 ||
      num > 255 ||
      Math.floor(num) !== num ||
      octet !== num.toString()
    ) {
      return false;
    }
  }
  return true;
}

function isValidPort(portStr: string): boolean {
  const port = Number(portStr);
  return (
    Number.isFinite(port) &&
    port >= 1 &&
    port <= 65535 &&
    Math.floor(port) === port
  );
}

// ---------------------------------------------------------------------------
// Custom hook: usePeers
// ---------------------------------------------------------------------------

function usePeers() {
  const [peers, setPeers] = useState<PeerRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadPeers = useCallback(() => {
    const db = getDatabase();
    if (!db) return;

    db.getKnownPeers(100).then((rows) => {
      setPeers(rows);
      setLoaded(true);
    });
  }, []);

  const addPeer = useCallback(
    (host: string, port: number) => {
      const db = getDatabase();
      if (!db) return;

      db.insertPeer(host, port, 1).then(() => {
        loadPeers();
      });
    },
    [loadPeers],
  );

  return { peers, loaded, loadPeers, addPeer };
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function PeersScreen() {
  const connectedPeers = useWalletStore((s) => s.connectedPeers);
  const chainHeight = useWalletStore((s) => s.chainHeight);
  const isSyncing = useWalletStore((s) => s.isSyncing);
  const syncProgress = useWalletStore((s) => s.syncProgress);
  const network = useWalletStore((s) => s.network);

  const { peers, loadPeers, addPeer } = usePeers();

  const [ipInput, setIpInput] = useState("");
  const [portInput, setPortInput] = useState(DEFAULT_PORT);
  const [addError, setAddError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadPeers();
    }, [loadPeers]),
  );

  const syncStatusText = useMemo(() => {
    if (connectedPeers === 0) return "Offline";
    if (isSyncing) return `Syncing ${Math.round(syncProgress)}%`;
    return "Synced";
  }, [connectedPeers, isSyncing, syncProgress]);

  const syncStatusVariant = useMemo<"success" | "warning" | "error">(() => {
    if (connectedPeers === 0) return "error";
    if (isSyncing) return "warning";
    return "success";
  }, [connectedPeers, isSyncing]);

  const handleAddPeer = useCallback(() => {
    const trimmedIp = ipInput.trim();
    const trimmedPort = portInput.trim() || DEFAULT_PORT;

    if (!trimmedIp) {
      setAddError("Please enter an IP address.");
      return;
    }

    if (!isValidIPv4(trimmedIp)) {
      setAddError("Please enter a valid IPv4 address (e.g. 192.168.1.1).");
      return;
    }

    if (!isValidPort(trimmedPort)) {
      setAddError("Please enter a valid port number (1-65535).");
      return;
    }

    setAddError(null);
    addPeer(trimmedIp, Number(trimmedPort));
    setIpInput("");
    setPortInput(DEFAULT_PORT);
    Alert.alert("Peer Added", `Added ${trimmedIp}:${trimmedPort} to peer list.`);
  }, [ipInput, portInput, addPeer]);

  return (
    <SafeAreaView
      className="flex-1 bg-fair-dark"
      edges={["top", "bottom", "left", "right"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8"
      >
        <ScreenHeader
          title="Network Peers"
          subtitle={`${connectedPeers} connected`}
        />

        {/* Stats card */}
        <Card className="p-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-fair-muted text-sm">Connected Peers</Text>
            <Text className="text-white text-sm font-semibold">
              {connectedPeers}
            </Text>
          </View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-fair-muted text-sm">Chain Height</Text>
            <Text className="text-white text-sm font-semibold">
              {chainHeight > 0 ? chainHeight.toLocaleString() : "Unknown"}
            </Text>
          </View>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-fair-muted text-sm">Sync Status</Text>
            <Badge text={syncStatusText} variant={syncStatusVariant} />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-fair-muted text-sm">Network</Text>
            <Badge
              text={network === "testnet" ? "Testnet" : "Mainnet"}
              variant={network === "testnet" ? "warning" : "info"}
            />
          </View>
        </Card>

        {/* Connected peers list */}
        <Section title="Known Peers" className="mb-6">
          {peers.length === 0 ? (
            <EmptyState
              icon="server-network-off"
              title="No peers found"
              subtitle="No peer data available yet. Peers will appear once the wallet connects to the network."
            />
          ) : (
            peers.map((peer, idx) => {
              const serviceLabels = getServiceLabels(peer.services);
              return (
                <ListItem
                  key={`${peer.host}-${peer.port}`}
                  icon="server-network"
                  title={`${peer.host}:${peer.port}`}
                  subtitle={serviceLabels.join(", ")}
                  value={formatLastSeen(peer.last_seen)}
                  isLast={idx === peers.length - 1}
                  showChevron={false}
                  trailing={
                    <Badge
                      text={serviceLabels[0]}
                      variant="info"
                      size="sm"
                    />
                  }
                />
              );
            })
          )}
        </Section>

        {/* Add peer section */}
        <Section title="Add Peer" className="mb-6">
          <Card className="p-4">
            <Text className="text-fair-muted text-xs mb-1">IP Address</Text>
            <TextInput
              className="bg-fair-dark border border-fair-border rounded-xl px-4 py-3 text-white text-base mb-3"
              placeholder="192.168.1.1"
              placeholderTextColor="#6b7280"
              value={ipInput}
              onChangeText={(text) => {
                setIpInput(text);
                setAddError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />

            <Text className="text-fair-muted text-xs mb-1">Port</Text>
            <TextInput
              className="bg-fair-dark border border-fair-border rounded-xl px-4 py-3 text-white text-base mb-3"
              placeholder={DEFAULT_PORT}
              placeholderTextColor="#6b7280"
              value={portInput}
              onChangeText={(text) => {
                setPortInput(text);
                setAddError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
            />

            {addError ? (
              <Text className="text-red-400 text-xs mb-3">{addError}</Text>
            ) : null}

            <Button title="Connect" onPress={handleAddPeer} variant="primary" />
          </Card>
        </Section>

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
    </SafeAreaView>
  );
}
