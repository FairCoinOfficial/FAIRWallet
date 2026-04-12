/**
 * PinPad — Revolut-style circular number pad for PIN entry.
 * Renders a 4×3 grid: digits 1-9, biometric/empty, 0, backspace.
 */

import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "@oxyhq/bloom/theme";
import { hapticSelection, hapticImpact } from "../../utils/haptics";

interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  biometricButton?: React.ReactNode;
  tintColor?: string;
  disabledColor?: string;
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
  tintColor,
  disabledColor,
}: PinPadProps) {
  const theme = useTheme();
  const activeColor = tintColor ?? theme.colors.text;
  const inactiveColor = disabledColor ?? theme.colors.card;

  const handleDigit = useCallback(
    (digit: string) => {
      if (!disabled) {
        hapticSelection();
        onDigit(digit);
      }
    },
    [disabled, onDigit],
  );

  const handleBack = useCallback(() => {
    if (!disabled) {
      hapticImpact();
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
                  className="w-18 h-18 rounded-full items-center justify-center active:bg-surface"
                  onPress={handleBack}
                  disabled={disabled}
                >
                  <MaterialCommunityIcons
                    name="backspace-outline"
                    size={26}
                    color={disabled ? inactiveColor : theme.colors.textSecondary}
                  />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={`key-${key}`}
                className={`w-18 h-18 rounded-full items-center justify-center ${
                  disabled ? "opacity-30" : "active:bg-primary/10"
                }`}
                onPress={() => handleDigit(key)}
                disabled={disabled}
              >
                <Text
                  style={{ color: disabled ? theme.colors.textSecondary : activeColor }}
                  className="text-3xl font-light"
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
