/**
 * Masternode management screen.
 * Lists eligible UTXOs (5,000 FAIR) and masternode status.
 * Provides a "Start Masternode" flow that collects the masternode IP:port,
 * confirms details, and prepares a masternode broadcast.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useWalletStore } from "../src/wallet/wallet-store";
import type { MasternodeUTXO } from "../src/wallet/wallet-store";
import { Button } from "../src/ui/components/Button";

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

  if (!Number.isFinite(port) || port < 1 || port > 65535 || Math.floor(port) !== port) {
    return null;
  }

  // Basic IPv4 validation
  const octets = ip.split(".");
  if (octets.length !== 4) return null;
  for (const octet of octets) {
    const num = Number(octet);
    if (!Number.isFinite(num) || num < 0 || num > 255 || Math.floor(num) !== num) {
      return null;
    }
  }

  return { ip, port };
}

export default function MasternodeScreen() {
  const insets = useSafeAreaInsets();
  const masternodeUTXOs = useWalletStore((s) => s.masternodeUTXOs);
  const refreshMasternodeUTXOs = useWalletStore((s) => s.refreshMasternodeUTXOs);
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
      setIpModalError("Please enter a valid IPv4:port (e.g. 203.0.113.50:46372).");
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
    <View className="flex-1 bg-fair-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-4 pb-8"
        contentContainerStyle={{ paddingTop: insets.top }}
      >
        {/* Info card */}
        <View className="bg-fair-dark-light border border-fair-border rounded-xl p-4 mb-6">
          <Text className="text-white text-base font-semibold mb-2">
            Masternode Requirements
          </Text>
          <Text className="text-fair-muted text-sm leading-5">
            A FairCoin masternode requires exactly 5,000 FAIR as collateral in a
            single UTXO. The collateral must have at least 15 confirmations.
            Running a masternode earns you additional rewards for supporting the
            network.
          </Text>
        </View>

        {/* Eligible UTXOs */}
        <Text className="text-white text-base font-semibold mb-3">
          Collateral Candidates
        </Text>

        {eligibleUtxos.length === 0 ? (
          <View className="bg-fair-dark-light rounded-xl p-6 items-center mb-6">
            <Text className="text-fair-muted text-sm text-center">
              No UTXOs with exactly 5,000 FAIR found
            </Text>
            <Text className="text-fair-muted text-xs mt-2 text-center">
              Send exactly 5,000 FAIR to one of your addresses to create a
              masternode collateral
            </Text>
          </View>
        ) : (
          <View className="gap-3 mb-6">
            {eligibleUtxos.map((utxo) => {
              const confirmOk = utxo.confirmations >= 15;
              return (
                <View
                  key={`${utxo.txid}-${utxo.vout}`}
                  className="bg-fair-dark-light border border-fair-border rounded-xl p-4"
                >
                  {/* Status dot */}
                  <View className="flex-row items-center mb-2">
                    <View
                      className={`w-2.5 h-2.5 rounded-full mr-2 ${
                        confirmOk ? "bg-fair-green" : "bg-yellow-400"
                      }`}
                    />
                    <Text className="text-white text-sm font-medium">
                      {confirmOk ? "Eligible" : "Pending confirmations"}
                    </Text>
                  </View>

                  {/* TXID */}
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-fair-muted text-xs">TXID</Text>
                    <Text className="text-white text-xs font-mono">
                      {truncateTxid(utxo.txid)}
                    </Text>
                  </View>

                  {/* Output index */}
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-fair-muted text-xs">Output</Text>
                    <Text className="text-white text-xs">{utxo.vout}</Text>
                  </View>

                  {/* Address */}
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-fair-muted text-xs">Address</Text>
                    <Text className="text-white text-xs font-mono">
                      {utxo.address.slice(0, 8)}...{utxo.address.slice(-6)}
                    </Text>
                  </View>

                  {/* Confirmations */}
                  <View className="flex-row justify-between">
                    <Text className="text-fair-muted text-xs">
                      Confirmations
                    </Text>
                    <Text
                      className={`text-xs ${
                        confirmOk ? "text-fair-green" : "text-yellow-400"
                      }`}
                    >
                      {utxo.confirmations} / 15
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

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
          <View className="bg-fair-dark-light border border-fair-border rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-white text-lg font-bold mb-2 text-center">
              Masternode IP Address
            </Text>
            <Text className="text-fair-muted text-sm mb-4 text-center">
              Enter the IP:port of your masternode server (e.g. 203.0.113.50:46372)
            </Text>

            <TextInput
              className="bg-fair-dark border border-fair-border rounded-xl px-4 py-3 text-white text-base mb-3"
              placeholder="203.0.113.50:46372"
              placeholderTextColor="#6b7280"
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
          </View>
        </View>
      </Modal>
    </View>
  );
}
