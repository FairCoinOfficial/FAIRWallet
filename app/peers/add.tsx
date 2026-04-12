/**
 * Add Peer screen — form to manually add a P2P peer by IP and port.
 */

import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@oxyhq/bloom/theme";
import * as Prompt from "@oxyhq/bloom/prompt";
import { getDatabase } from "../../src/wallet/wallet-store";
import { Card } from "../../src/ui/components/Card";
import { Button } from "../../src/ui/components/Button";

const DEFAULT_PORT = "46372";

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

export default function AddPeerScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [ip, setIp] = useState("");
  const [port, setPort] = useState(DEFAULT_PORT);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState<{
    title: string;
    description: string;
    onConfirm?: () => void;
  } | null>(null);
  const messageControl = Prompt.usePromptControl();

  const showMessage = useCallback(
    (title: string, description: string, onConfirm?: () => void) => {
      setMessage({ title, description, onConfirm });
      messageControl.open();
    },
    [messageControl],
  );

  const handleAdd = useCallback(async () => {
    const trimmedIp = ip.trim();
    const trimmedPort = port.trim() || DEFAULT_PORT;

    if (!trimmedIp) {
      setError("Please enter an IP address.");
      return;
    }
    if (!isValidIPv4(trimmedIp)) {
      setError("Please enter a valid IPv4 address (e.g. 192.168.1.1).");
      return;
    }
    if (!isValidPort(trimmedPort)) {
      setError("Please enter a valid port number (1–65535).");
      return;
    }

    setError(null);
    setLoading(true);

    const db = getDatabase();
    if (db) {
      await db.insertPeer(trimmedIp, Number(trimmedPort), 1);
    }

    setLoading(false);
    showMessage("Peer Added", `${trimmedIp}:${trimmedPort}`, () =>
      router.back(),
    );
  }, [ip, port, router, showMessage]);

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="px-5 pt-6 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-muted-foreground text-sm mb-6">
          Enter the IP address and port of a FairCoin node to connect to it
          directly. The default port is {DEFAULT_PORT}.
        </Text>

        <Card className="p-4 mb-6">
          <Text className="text-muted-foreground text-xs mb-1">IP Address</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base mb-4"
            placeholder="192.168.1.1"
            placeholderTextColor={theme.colors.textSecondary}
            value={ip}
            onChangeText={(text) => {
              setIp(text);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
          />

          <Text className="text-muted-foreground text-xs mb-1">Port</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-base"
            placeholder={DEFAULT_PORT}
            placeholderTextColor={theme.colors.textSecondary}
            value={port}
            onChangeText={(text) => {
              setPort(text);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </Card>

        {error ? (
          <Text className="text-destructive text-sm mb-4 px-1">{error}</Text>
        ) : null}

        <Button
          title="Add Peer"
          onPress={handleAdd}
          variant="primary"
          loading={loading}
          disabled={loading}
        />
      </ScrollView>

      <Prompt.Basic
        control={messageControl}
        title={message?.title ?? ""}
        description={message?.description ?? ""}
        confirmButtonCta="OK"
        onConfirm={() => {
          const cb = message?.onConfirm;
          setMessage(null);
          cb?.();
        }}
        showCancel={false}
      />
    </>
  );
}
