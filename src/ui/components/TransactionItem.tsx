/**
 * Transaction list item component.
 */

import { useMemo } from "react";
import { View, Text } from "react-native";

type TransactionType = "send" | "receive" | "stake" | "masternode_reward";

interface TransactionItemProps {
  type: TransactionType;
  amount: string;
  address: string;
  timestamp: number;
  confirmations: number;
}

const TYPE_CONFIG: Record<
  TransactionType,
  { icon: string; amountColor: string; label: string }
> = {
  send: { icon: "\u2191", amountColor: "text-red-400", label: "Sent" },
  receive: {
    icon: "\u2193",
    amountColor: "text-fair-green",
    label: "Received",
  },
  stake: {
    icon: "\u2605",
    amountColor: "text-fair-green-dim",
    label: "Stake",
  },
  masternode_reward: {
    icon: "\u2606",
    amountColor: "text-fair-green",
    label: "Masternode",
  },
};

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function getConfirmationColor(confirmations: number): string {
  if (confirmations === 0) return "text-red-400";
  if (confirmations < 6) return "text-yellow-400";
  return "text-fair-green";
}

export function TransactionItem({
  type,
  amount,
  address,
  timestamp,
  confirmations,
}: TransactionItemProps) {
  const config = TYPE_CONFIG[type];
  const timeAgo = useMemo(() => formatTimeAgo(timestamp), [timestamp]);
  const truncated = useMemo(() => truncateAddress(address), [address]);
  const confirmColor = useMemo(
    () => getConfirmationColor(confirmations),
    [confirmations],
  );

  const amountPrefix = type === "send" ? "-" : "+";

  return (
    <View className="flex-row items-center py-3 px-4 border-b border-fair-border">
      {/* Icon */}
      <View className="w-10 h-10 rounded-full bg-fair-dark-light items-center justify-center mr-3">
        <Text className="text-lg text-white">{config.icon}</Text>
      </View>

      {/* Details */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-sm font-medium">
            {config.label}
          </Text>
          <Text className={`text-sm font-semibold ${config.amountColor}`}>
            {amountPrefix}
            {amount} FAIR
          </Text>
        </View>
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-fair-muted text-xs">{truncated}</Text>
          <View className="flex-row items-center">
            <Text className={`text-xs ${confirmColor} mr-2`}>
              {confirmations} conf
            </Text>
            <Text className="text-fair-muted text-xs">{timeAgo}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
