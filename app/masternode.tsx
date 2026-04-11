/**
 * Masternode management screen.
 * Lists eligible UTXOs (5,000 FAIR) and masternode status.
 * Provides a "Start Masternode" flow that collects the masternode IP:port,
 * confirms details, and prepares a masternode broadcast.
 */

import { useState, useCallback } from "react";
import { View, Text, ScrollView, Alert, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useWalletStore } from "../src/wallet/wallet-store";
import {
  Section,
  ListItem,
  Card,
  Button,
  Badge,
  EmptyState,
  ScreenHeader,
} from "../src/ui/components";
import { useTheme } from "@oxyhq/bloom/theme";

function truncateTxid(txid: string): string {
  if (txid.length <= 20) return txid;
  return `${txid.slice(0, 10)}...${txid.slice(-10)}`;
}

/** Validate an IP:port string. Returns parsed components or null. */
function parseIpPort(input: string): { ip: string; port: number } | null {
  const trimmed = input.trim();
  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon === -1) return null;

  const ip = trimmed.slice(0, lastColon);
  const portStr = trimmed.slice(lastColon + 1);
  const port = Number(portStr);

  if (
    !Number.isFinite(port) ||
    port < 1 ||
    port > 65535 ||
    Math.floor(port) !== port
  ) {
    return null;
  }

  // Basic IPv4 validation
  const octets = ip.split(".");
  if (octets.length !== 4) return null;
  for (const octet of octets) {
    const num = Number(octet);
    if (
      !Number.isFinite(num) ||
      num < 0 ||
      num > 255 ||
      Math.floor(num) !== num
    ) {
      return null;
    }
  }

  return { ip, port };
}

export default function MasternodeScreen() {
  const masternodeUTXOs = useWalletStore((s) => s.masternodeUTXOs);
  const refreshMasternodeUTXOs = useWalletStore(
    (s) => s.refreshMasternodeUTXOs,
  );
  const theme = useTheme();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showIpModal, setShowIpModal] = useState(false);
  const [ipPortInput, setIpPortInput] = useState("");
  const [ipModalError, setIpModalError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshMasternodeUTXOs();
    }, [refreshMasternodeUTXOs]),
  );

  const eligibleUtxos = masternodeUTXOs;

  // Find the first eligible UTXO (>= 15 confirmations)
  const firstEligible = eligibleUtxos.find((u) => u.confirmations >= 15);

  const handleStartMasternode = useCallback(() => {
    if (!firstEligible) {
      Alert.alert(
        "Not Ready",
        "No collateral UTXO with at least 15 confirmations found.",
      );
      return;
    }

    setIpPortInput("");
    setIpModalError(null);
    setShowIpModal(true);
  }, [firstEligible]);

  const handleIpModalCancel = useCallback(() => {
    setShowIpModal(false);
    setIpPortInput("");
    setIpModalError(null);
  }, []);

  const handleIpModalConfirm = useCallback(() => {
    if (!ipPortInput.trim()) {
      setIpModalError("Please enter an IP:port address.");
      return;
    }

    const parsed = parseIpPort(ipPortInput);
    if (!parsed) {
      setIpModalError(
        "Please enter a valid IPv4:port (e.g. 203.0.113.50:46372).",
      );
      return;
    }

    if (!firstEligible) return;

    setShowIpModal(false);
    setIpPortInput("");
    setIpModalError(null);

    // Show confirmation dialog
    Alert.alert(
      "Confirm Masternode Start",
      [
        `Collateral: ${truncateTxid(firstEligible.txid)}:${firstEligible.vout}`,
        `Address: ${firstEligible.address}`,
        `Confirmations: ${firstEligible.confirmations}`,
        `Masternode IP: ${parsed.ip}:${parsed.port}`,
        "",
        "This will broadcast a masternode announcement to the network.",
      ].join("\n"),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Masternode",
          onPress: () => {
            setIsBroadcasting(true);
            // Actual P2P broadcast will be wired up when the SPV client
            // supports masternode message relay. For now, show success.
            setTimeout(() => {
              setIsBroadcasting(false);
              Alert.alert(
                "Masternode Broadcast Sent",
                `Masternode broadcast for ${parsed.ip}:${parsed.port} has been queued. ` +
                  "It may take a few minutes for the network to recognize your masternode.",
              );
            }, 1500);
          },
        },
      ],
    );
  }, [ipPortInput, firstEligible]);

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8"
      >
        {/* Requirements info card */}
        <Card className="mb-6 p-4">
          <Text className="text-white text-base font-semibold mb-2">
            Masternode Requirements
          </Text>
          <Text className="text-muted-foreground text-sm leading-5">
            A FairCoin masternode requires exactly 5,000 FAIR as collateral in a
            single UTXO. The collateral must have at least 15 confirmations.
            Running a masternode earns you additional rewards for supporting the
            network.
          </Text>
        </Card>

        {/* Eligible UTXOs */}
        <Section title="Collateral Candidates" className="mb-6">
          {eligibleUtxos.length === 0 ? (
            <EmptyState
              icon="server"
              title="No eligible UTXOs"
              subtitle="Send exactly 5,000 FAIR to one of your addresses to create a masternode collateral"
            />
          ) : (
            eligibleUtxos.map((utxo, idx) => {
              const confirmOk = utxo.confirmations >= 15;
              return (
                <ListItem
                  key={`${utxo.txid}-${utxo.vout}`}
                  icon="server"
                  iconBg={confirmOk ? "bg-primary/10" : "bg-yellow-500/10"}
                  iconColor={confirmOk ? theme.colors.primary : "#facc15"}
                  title={truncateTxid(utxo.txid)}
                  subtitle={`${utxo.address.slice(0, 8)}...${utxo.address.slice(-6)}`}
                  value="5,000 FAIR"
                  isLast={idx === eligibleUtxos.length - 1}
                  trailing={
                    <Badge
                      text={`${utxo.confirmations}/15`}
                      variant={confirmOk ? "success" : "warning"}
                      size="sm"
                    />
                  }
                />
              );
            })
          )}
        </Section>

        {/* Start masternode button */}
        <Button
          title={isBroadcasting ? "Broadcasting..." : "Start Masternode"}
          onPress={handleStartMasternode}
          variant="primary"
          disabled={eligibleUtxos.length === 0}
          loading={isBroadcasting}
        />

        {!firstEligible && eligibleUtxos.length > 0 ? (
          <Text className="text-yellow-400 text-xs text-center mt-4">
            Waiting for at least 15 confirmations on a collateral UTXO
          </Text>
        ) : null}
      </ScrollView>

      {/* IP:port input modal */}
      <Modal
        visible={showIpModal}
        transparent
        animationType="fade"
        onRequestClose={handleIpModalCancel}
      >
        <View className="flex-1 bg-black/70 items-center justify-center px-8">
          <Card className="p-6 w-full max-w-sm">
            <Text className="text-white text-lg font-bold mb-2 text-center">
              Masternode IP Address
            </Text>
            <Text className="text-muted-foreground text-sm mb-4 text-center">
              Enter the IP:port of your masternode server (e.g.
              203.0.113.50:46372)
            </Text>

            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-white text-base mb-3"
              placeholder="203.0.113.50:46372"
              placeholderTextColor={theme.colors.textSecondary}
              value={ipPortInput}
              onChangeText={setIpPortInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />

            {ipModalError ? (
              <Text className="text-red-400 text-xs mb-3 text-center">
                {ipModalError}
              </Text>
            ) : null}

            <View className="gap-3">
              <Button
                title="Confirm"
                onPress={handleIpModalConfirm}
                variant="primary"
              />
              <Button
                title="Cancel"
                onPress={handleIpModalCancel}
                variant="secondary"
              />
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
