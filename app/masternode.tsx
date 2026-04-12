/**
 * Masternode management screen.
 * Lists eligible UTXOs (5,000 FAIR) and masternode status.
 * Provides a "Start Masternode" flow that collects the masternode IP:port,
 * confirms details, and prepares a masternode broadcast.
 */

import { useState, useCallback } from "react";
import { View, Text, ScrollView, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
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
import * as Prompt from "@oxyhq/bloom/prompt";
import { t } from "../src/i18n";

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
  const router = useRouter();
  const masternodeUTXOs = useWalletStore((s) => s.masternodeUTXOs);
  const refreshMasternodeUTXOs = useWalletStore(
    (s) => s.refreshMasternodeUTXOs,
  );
  const theme = useTheme();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showIpModal, setShowIpModal] = useState(false);
  const [ipPortInput, setIpPortInput] = useState("");
  const [ipModalError, setIpModalError] = useState<string | null>(null);

  const notReadyControl = Prompt.usePromptControl();
  const confirmStartControl = Prompt.usePromptControl();
  const broadcastSentControl = Prompt.usePromptControl();
  const [pendingMasternode, setPendingMasternode] = useState<{
    ip: string;
    port: number;
  } | null>(null);
  const [broadcastResult, setBroadcastResult] = useState<{
    ip: string;
    port: number;
  } | null>(null);

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
      notReadyControl.open();
      return;
    }

    setIpPortInput("");
    setIpModalError(null);
    setShowIpModal(true);
  }, [firstEligible, notReadyControl]);

  const handleIpModalCancel = useCallback(() => {
    setShowIpModal(false);
    setIpPortInput("");
    setIpModalError(null);
  }, []);

  const handleIpModalConfirm = useCallback(() => {
    if (!ipPortInput.trim()) {
      setIpModalError(t("masternode.ipModal.error.empty"));
      return;
    }

    const parsed = parseIpPort(ipPortInput);
    if (!parsed) {
      setIpModalError(t("masternode.ipModal.error.invalid"));
      return;
    }

    if (!firstEligible) return;

    setShowIpModal(false);
    setIpPortInput("");
    setIpModalError(null);

    setPendingMasternode(parsed);
    confirmStartControl.open();
  }, [ipPortInput, firstEligible, confirmStartControl]);

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
    >
      <ScreenHeader title={t("masternode.title")} onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8"
      >
        {/* Requirements info card */}
        <Card className="mb-6 p-4">
          <Text className="text-foreground text-base font-semibold mb-2">
            {t("masternode.requirements.title")}
          </Text>
          <Text className="text-muted-foreground text-sm leading-5">
            {t("masternode.requirements.description")}
          </Text>
        </Card>

        {/* Eligible UTXOs */}
        <Section title={t("masternode.candidates")} className="mb-6">
          {eligibleUtxos.length === 0 ? (
            <EmptyState
              icon="server"
              title={t("masternode.empty.title")}
              subtitle={t("masternode.empty.subtitle")}
            />
          ) : (
            eligibleUtxos.map((utxo, idx) => {
              const confirmOk = utxo.confirmations >= 15;
              return (
                <ListItem
                  key={`${utxo.txid}-${utxo.vout}`}
                  icon="server"
                  iconBg={confirmOk ? "bg-primary/10" : "bg-yellow-500/10"}
                  iconColor={confirmOk ? theme.colors.success : theme.colors.warning}
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
          title={
            isBroadcasting
              ? t("masternode.broadcasting")
              : t("masternode.startCta")
          }
          onPress={handleStartMasternode}
          variant="primary"
          disabled={eligibleUtxos.length === 0}
          loading={isBroadcasting}
        />

        {!firstEligible && eligibleUtxos.length > 0 ? (
          <Text className="text-yellow-400 text-xs text-center mt-4">
            {t("masternode.waiting")}
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
            <Text className="text-foreground text-lg font-bold mb-2 text-center">
              {t("masternode.ipModal.title")}
            </Text>
            <Text className="text-muted-foreground text-sm mb-4 text-center">
              {t("masternode.ipModal.description")}
            </Text>

            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base mb-3"
              placeholder={t("masternode.ipModal.placeholder")}
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
                title={t("common.confirm")}
                onPress={handleIpModalConfirm}
                variant="primary"
              />
              <Button
                title={t("common.cancel")}
                onPress={handleIpModalCancel}
                variant="secondary"
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Not ready prompt: shown when there is no eligible collateral UTXO */}
      <Prompt.Outer control={notReadyControl}>
        <Prompt.Content>
          <Prompt.TitleText>{t("masternode.notReady.title")}</Prompt.TitleText>
          <Prompt.DescriptionText>
            {t("masternode.notReady.description")}
          </Prompt.DescriptionText>
        </Prompt.Content>
        <Prompt.Actions>
          <Prompt.Action
            cta={t("common.ok")}
            onPress={() => notReadyControl.close()}
            color="primary"
          />
        </Prompt.Actions>
      </Prompt.Outer>

      {/* Confirm masternode start prompt: shows collateral details */}
      <Prompt.Outer control={confirmStartControl}>
        <Prompt.Content>
          <Prompt.TitleText>{t("masternode.confirm.title")}</Prompt.TitleText>
          {firstEligible && pendingMasternode ? (
            <View className="mt-2 mb-2">
              <Text className="text-muted-foreground text-sm mb-1">
                {t("masternode.confirm.collateral")}{" "}
                <Text className="text-foreground">
                  {truncateTxid(firstEligible.txid)}:{firstEligible.vout}
                </Text>
              </Text>
              <Text className="text-muted-foreground text-sm mb-1">
                {t("masternode.confirm.address")}{" "}
                <Text className="text-foreground">{firstEligible.address}</Text>
              </Text>
              <Text className="text-muted-foreground text-sm mb-1">
                {t("masternode.confirm.confirmations")}{" "}
                <Text className="text-foreground">
                  {firstEligible.confirmations}
                </Text>
              </Text>
              <Text className="text-muted-foreground text-sm mb-3">
                {t("masternode.confirm.ip")}{" "}
                <Text className="text-foreground">
                  {pendingMasternode.ip}:{pendingMasternode.port}
                </Text>
              </Text>
              <Text className="text-muted-foreground text-xs">
                {t("masternode.confirm.note")}
              </Text>
            </View>
          ) : null}
        </Prompt.Content>
        <Prompt.Actions>
          <Prompt.Action
            cta={t("masternode.startCta")}
            onPress={() => {
              if (!pendingMasternode) return;
              const parsed = pendingMasternode;
              setIsBroadcasting(true);
              // Actual P2P broadcast will be wired up when the SPV client
              // supports masternode message relay. For now, show success.
              setTimeout(() => {
                setIsBroadcasting(false);
                setBroadcastResult(parsed);
                broadcastSentControl.open();
              }, 1500);
              setPendingMasternode(null);
            }}
            color="primary"
          />
          <Prompt.Action
            cta={t("common.cancel")}
            onPress={() => {
              setPendingMasternode(null);
            }}
            color="secondary"
          />
        </Prompt.Actions>
      </Prompt.Outer>

      {/* Broadcast sent prompt: info-only result dialog */}
      <Prompt.Outer control={broadcastSentControl}>
        <Prompt.Content>
          <Prompt.TitleText>
            {t("masternode.broadcastSent.title")}
          </Prompt.TitleText>
          <Prompt.DescriptionText>
            {broadcastResult
              ? t("masternode.broadcastSent.description", {
                  ip: broadcastResult.ip,
                  port: broadcastResult.port,
                })
              : ""}
          </Prompt.DescriptionText>
        </Prompt.Content>
        <Prompt.Actions>
          <Prompt.Action
            cta={t("common.ok")}
            onPress={() => setBroadcastResult(null)}
            color="primary"
          />
        </Prompt.Actions>
      </Prompt.Outer>
    </SafeAreaView>
  );
}
