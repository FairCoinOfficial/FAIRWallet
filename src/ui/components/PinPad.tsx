/**
 * PinPad — Revolut-style circular number pad for PIN entry.
 * Renders a 4×3 grid: digits 1-9, biometric/empty, 0, backspace.
 */

import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  biometricButton?: React.ReactNode;
}

const ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["bio", "0", "back"],
];

export function PinPad({
  onDigit,
  onBackspace,
  disabled = false,
  biometricButton,
}: PinPadProps) {
  const handleDigit = useCallback(
    (digit: string) => {
      if (!disabled) {
        onDigit(digit);
      }
    },
    [disabled, onDigit],
  );

  const handleBack = useCallback(() => {
    if (!disabled) {
      onBackspace();
    }
  }, [disabled, onBackspace]);

  return (
    <View className="w-full items-center">
      {ROWS.map((row, rowIdx) => (
        <View key={`pad-row-${rowIdx}`} className="flex-row justify-center gap-6 mb-4">
          {row.map((key) => {
            if (key === "bio") {
              if (biometricButton) {
                return (
                  <View key="biometric" className="w-18 h-18 items-center justify-center">
                    {biometricButton}
                  </View>
                );
              }
              return <View key="empty" className="w-18 h-18" />;
            }

            if (key === "back") {
              return (
                <Pressable
                  key="backspace"
                  className="w-18 h-18 rounded-full items-center justify-center active:bg-fair-dark-light"
                  onPress={handleBack}
                  disabled={disabled}
                >
                  <MaterialCommunityIcons
                    name="backspace-outline"
                    size={26}
                    color={disabled ? "#2a2e14" : "#6b7280"}
                  />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={`key-${key}`}
                className={`w-18 h-18 rounded-full items-center justify-center ${
                  disabled ? "opacity-30" : "active:bg-fair-green/10"
                }`}
                onPress={() => handleDigit(key)}
                disabled={disabled}
              >
                <Text
                  className={`text-3xl font-light ${
                    disabled ? "text-fair-muted/50" : "text-white"
                  }`}
                >
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
