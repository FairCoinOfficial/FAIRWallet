/**
 * PIN setup screen shown after wallet creation/restore during onboarding.
 * Prompts user to set and confirm a 6-digit PIN.
 */

import { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { savePin } from "../../src/storage/secure-store";

const PIN_LENGTH = 6;

type PinPhase = "create" | "confirm";

export default function PinSetupScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<PinPhase>("create");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (saving) return;

      setError(null);
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + digit;

        if (next.length === PIN_LENGTH) {
          if (phase === "create") {
            // Move to confirm phase after a brief delay so user sees the last dot
            setTimeout(() => {
              setFirstPin(next);
              setPin("");
              setPhase("confirm");
            }, 200);
          } else {
            // Confirm phase - check match
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
                setError("PINs do not match. Try again.");
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

  const title = phase === "create" ? "Set a PIN" : "Confirm PIN";
  const subtitle =
    phase === "create"
      ? "Choose a 6-digit PIN to secure your wallet"
      : "Re-enter your PIN to confirm";

  return (
    <SafeAreaView className="flex-1 bg-fair-dark">
      <View className="flex-1 items-center justify-between px-6 pt-20 pb-10">
        {/* Header */}
        <View className="items-center">
          <Text className="text-white text-2xl font-bold mb-2">{title}</Text>
          <Text className="text-fair-muted text-sm text-center mb-8">
            {subtitle}
          </Text>

          {/* PIN dots */}
          <View className="flex-row gap-4 mb-6">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View
                key={`dot-${i}`}
                className={`w-4 h-4 rounded-full ${
                  i < pin.length ? "bg-fair-green" : "bg-fair-dark-light"
                }`}
              />
            ))}
          </View>

          {/* Error */}
          {error ? (
            <Text className="text-red-400 text-sm text-center">{error}</Text>
          ) : null}
        </View>

        {/* Number pad */}
        <View className="w-full max-w-xs">
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["", "0", "back"],
          ].map((row, rowIdx) => (
            <View key={`row-${rowIdx}`} className="flex-row justify-around mb-4">
              {row.map((key) => {
                if (key === "") {
                  return (
                    <View key="empty" className="w-20 h-16" />
                  );
                }
                if (key === "back") {
                  return (
                    <Pressable
                      key="backspace"
                      className="w-20 h-16 items-center justify-center rounded-2xl active:bg-fair-dark-light"
                      onPress={handleBackspace}
                    >
                      <Text className="text-fair-muted text-2xl">
                        {"\u232B"}
                      </Text>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={`key-${key}`}
                    className="w-20 h-16 items-center justify-center rounded-2xl bg-fair-dark-light active:bg-fair-green/20"
                    onPress={() => handleDigitPress(key)}
                  >
                    <Text className="text-white text-2xl font-medium">
                      {key}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
