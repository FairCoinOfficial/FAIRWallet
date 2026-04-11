/**
 * Sync status indicator component.
 */

import { useMemo } from "react";
import { View, Text } from "react-native";

interface SyncStatusProps {
  progress: number;
  isSyncing: boolean;
  connectedPeers: number;
  chainHeight: number;
  networkStatus: string;
}

type SyncState = "synced" | "syncing" | "disconnected";

function getSyncState(isSyncing: boolean, connectedPeers: number): SyncState {
  if (connectedPeers === 0) return "disconnected";
  if (isSyncing) return "syncing";
  return "synced";
}

const DOT_COLORS: Record<SyncState, string> = {
  synced: "bg-fair-green",
  syncing: "bg-yellow-400",
  disconnected: "bg-red-400",
};

export function SyncStatus({
  progress,
  isSyncing,
  connectedPeers,
  chainHeight,
  networkStatus,
}: SyncStatusProps) {
  const syncState = useMemo(
    () => getSyncState(isSyncing, connectedPeers),
    [isSyncing, connectedPeers],
  );

  const dotColor = DOT_COLORS[syncState];

  const statusLabel = useMemo(() => {
    if (syncState === "syncing") {
      return `Syncing... ${Math.round(progress)}%`;
    }
    if (syncState === "synced") {
      return "Synced";
    }
    return networkStatus;
  }, [syncState, progress, networkStatus]);

  return (
    <View className="bg-fair-dark-light rounded-xl px-4 py-3">
      <View className="flex-row items-center justify-between">
        {/* Status dot + text */}
        <View className="flex-row items-center flex-1 mr-2">
          <View className={`w-2.5 h-2.5 rounded-full ${dotColor} mr-2`} />
          <Text className="text-white text-sm flex-shrink" numberOfLines={2}>
            {statusLabel}
          </Text>
        </View>

        {/* Peers */}
        <Text className="text-fair-muted text-xs">
          {connectedPeers} {connectedPeers === 1 ? "peer" : "peers"}
        </Text>
      </View>

      {/* Progress bar */}
      {isSyncing ? (
        <View className="mt-2 h-1.5 bg-fair-dark rounded-full overflow-hidden">
          <View
            className="h-full bg-fair-green rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </View>
      ) : null}

      {/* Chain height */}
      {chainHeight > 0 ? (
        <Text className="text-fair-muted text-xs mt-1">
          Block #{chainHeight.toLocaleString()}
        </Text>
      ) : null}
    </View>
  );
}
