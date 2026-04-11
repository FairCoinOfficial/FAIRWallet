/**
 * Transaction list item — Revolut-inspired clean design.
 * Tappable to navigate to transaction details.
 */

import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type TransactionType = "send" | "receive" | "stake" | "masternode_reward";

interface TransactionItemProps {
  txid: string;
  type: TransactionType;
  amount: string;
  address: string;
  timestamp: number;
  confirmations: number;
}

const TYPE_CONFIG: Record<
  TransactionType,
  {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
    iconBg: string;
    iconColor: string;
    amountColor: string;
    label: string;
    prefix: string;
  }
> = {
  send: {
    icon: "arrow-up",
    iconBg: "bg-red-500/10",
    iconColor: "#f87171",
    amountColor: "text-red-400",
    label: "Sent",
    prefix: "-",
  },
  receive: {
    icon: "arrow-down",
    iconBg: "bg-fair-green/10",
    iconColor: "#9ffb50",
    amountColor: "text-fair-green",
    label: "Received",
    prefix: "+",
  },
  stake: {
    icon: "star-outline",
    iconBg: "bg-purple-500/10",
    iconColor: "#a78bfa",
    amountColor: "text-purple-400",
    label: "Staking Reward",
    prefix: "+",
  },
  masternode_reward: {
    icon: "server",
    iconBg: "bg-blue-500/10",
    iconColor: "#60a5fa",
    amountColor: "text-blue-400",
    label: "Masternode Reward",
    prefix: "+",
  },
};

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  const date = new Date(timestamp * 1000);
  const month = date.toLocaleString("en", { month: "short" });
  const day = date.getDate();
  return `${month} ${day}`;
}

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function TransactionItem({
  txid,
  type,
  amount,
  address,
  timestamp,
  confirmations,
}: TransactionItemProps) {
  const router = useRouter();
  const config = TYPE_CONFIG[type];
  const timeAgo = useMemo(() => formatTimeAgo(timestamp), [timestamp]);
  const truncated = useMemo(() => truncateAddress(address), [address]);

  const isPending = confirmations === 0;

  return (
    <Pressable
      className="flex-row items-center py-3.5 px-4 active:bg-fair-dark/50"
      onPress={() => router.push(`/transaction/${txid}`)}
    >
      {/* Icon */}
      <View
        className={`w-11 h-11 rounded-full ${config.iconBg} items-center justify-center mr-3`}
      >
        <MaterialCommunityIcons
          name={config.icon}
          size={20}
          color={config.iconColor}
        />
      </View>

      {/* Label + address */}
      <View className="flex-1 mr-3">
        <Text className="text-white text-sm font-medium" numberOfLines={1}>
          {config.label}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-fair-muted text-xs" numberOfLines={1}>
            {truncated}
          </Text>
          {isPending ? (
            <View className="ml-2 bg-yellow-500/15 rounded-full px-1.5 py-0.5">
              <Text className="text-yellow-400 text-[9px] font-bold">
                PENDING
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Amount + time */}
      <View className="items-end">
        <Text className={`text-sm font-semibold ${config.amountColor}`}>
          {config.prefix}{amount}
        </Text>
        <Text className="text-fair-muted text-xs mt-0.5">{timeAgo}</Text>
      </View>
    </Pressable>
  );
}
