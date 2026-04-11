/**
 * PIN setup screen — Revolut-style passcode creation during onboarding.
 * Prompts user to set and confirm a 6-digit PIN.
 */

import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { savePin } from "../../src/storage/secure-store";
import { PinPad } from "../../src/ui/components/PinPad";
import { PinDots } from "../../src/ui/components/PinDots";

const PIN_LENGTH = 6;

type PinPhase = "create" | "confirm";

export default function PinSetupScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<PinPhase>("create");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const title = phase === "create" ? "Create a passcode" : "Confirm your passcode";
  const subtitle =
    phase === "create"
      ? "This passcode will protect your wallet"
      : "Re-enter your passcode to confirm";

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (saving) return;

      setError(null);
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + digit;

        if (next.length === PIN_LENGTH) {
          if (phase === "create") {
            setTimeout(() => {
              setFirstPin(next);
              setPin("");
              setPhase("confirm");
            }, 200);
          } else {
            setTimeout(() => {
              if (next === firstPin) {
                setSaving(true);
                savePin(next)
                  .then(() => {
                    router.replace("/(tabs)");
                  })
                  .catch((err: unknown) => {
                    const msg =
                      err instanceof Error
                        ? err.message
                        : "Failed to save PIN";
                    setError(msg);
                    setSaving(false);
                    setPin("");
                  });
              } else {
                setError("Passcodes don\u2019t match. Let\u2019s try again.");
                setPin("");
                setFirstPin("");
                setPhase("create");
              }
            }, 200);
          }
        }

        return next;
      });
    },
    [phase, firstPin, saving, router],
  );

  const handleBackspace = useCallback(() => {
    if (saving) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [saving]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-between px-6 pt-16 pb-8">
        {/* Header + dots */}
        <View className="items-center flex-1 justify-center">
          <Text className="text-primary text-5xl mb-8">{"\u229C"}</Text>

          <Text className="text-white text-xl font-semibold mb-2">
            {title}
          </Text>
          <Text className="text-muted-foreground text-sm text-center mb-10">
            {subtitle}
          </Text>

          <PinDots
            length={PIN_LENGTH}
            filled={pin.length}
            error={error !== null}
          />

          {/* Error feedback */}
          <View className="h-12 justify-center mt-4">
            {error ? (
              <Text className="text-red-400 text-sm text-center px-4">
                {error}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Number pad */}
        <View className="w-full pb-4">
          <PinPad
            onDigit={handleDigitPress}
            onBackspace={handleBackspace}
            disabled={saving}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
