/**
 * PinPad — reusable number pad for PIN entry and setup.
 * Renders a 4×3 grid: digits 1-9, empty, 0, backspace.
 */

import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "back"],
];

export function PinPad({
  onDigit,
  onBackspace,
  disabled = false,
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
    <View className="w-full max-w-xs">
      {ROWS.map((row, rowIdx) => (
        <View key={`pad-row-${rowIdx}`} className="flex-row justify-around mb-4">
          {row.map((key) => {
            if (key === "") {
              return <View key="empty" className="w-20 h-16" />;
            }

            if (key === "back") {
              return (
                <Pressable
                  key="backspace"
                  className="w-20 h-16 items-center justify-center rounded-2xl active:bg-fair-dark-light"
                  onPress={handleBack}
                  disabled={disabled}
                >
                  <MaterialCommunityIcons
                    name="backspace-outline"
                    size={24}
                    color={disabled ? "#2a2e14" : "#6b7280"}
                  />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={`key-${key}`}
                className={`w-20 h-16 items-center justify-center rounded-2xl ${
                  disabled
                    ? "bg-fair-dark-light/50"
                    : "bg-fair-dark-light active:bg-fair-green/20"
                }`}
                onPress={() => handleDigit(key)}
                disabled={disabled}
              >
                <Text
                  className={`text-2xl font-medium ${
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
