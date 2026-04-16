/**
 * BuyAmountInput — large hero amount input for the Buy-FAIR flow.
 *
 * Wraps the shared `AmountInput` with the "⊜ ###.##" hero typography used on
 * the Send screen, plus a USD conversion line below the field. The conversion
 * uses the cached spot price from the explorer-backed price service; if the
 * price isn't available yet we hide the line rather than show "$0.00".
 */

import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "@oxyhq/bloom/theme";
import { COIN_SYMBOL, parseFairToUnits, UNITS_PER_COIN } from "@fairco.in/core";
import { AmountInput } from "../../ui/components/AmountInput";
import {
  FONT_PHUDU_BLACK,
  FONT_PHUDU_LIGHT,
} from "../../utils/fonts";
import { t } from "../../i18n";
import { getCachedPrice } from "../../services/price";

const AMOUNT_FONT_SIZE_MAX = 44;
const AMOUNT_FONT_SIZE_MIN = 22;
const AMOUNT_SYMBOL_RATIO = 34 / 44;
const AMOUNT_SHRINK_THRESHOLD = 9;
const AMOUNT_SHRINK_FLOOR = 18;

function getAmountFontSize(length: number): number {
  if (length <= AMOUNT_SHRINK_THRESHOLD) return AMOUNT_FONT_SIZE_MAX;
  if (length >= AMOUNT_SHRINK_FLOOR) return AMOUNT_FONT_SIZE_MIN;
  const range = AMOUNT_SHRINK_FLOOR - AMOUNT_SHRINK_THRESHOLD;
  const progress = (length - AMOUNT_SHRINK_THRESHOLD) / range;
  const span = AMOUNT_FONT_SIZE_MAX - AMOUNT_FONT_SIZE_MIN;
  return Math.round(AMOUNT_FONT_SIZE_MAX - span * progress);
}

interface BuyAmountInputProps {
  value: string;
  onValueChange: (next: string) => void;
  /** Optional preset chips ("10", "50", "100"). */
  presets?: ReadonlyArray<string>;
}

export function BuyAmountInput({
  value,
  onValueChange,
  presets,
}: BuyAmountInputProps) {
  const theme = useTheme();
  const amountSats = useMemo(() => parseFairToUnits(value), [value]);

  const usdEquivalent = useMemo(() => {
    const price = getCachedPrice();
    if (!price || amountSats === null || amountSats <= 0n) return null;
    const fair = Number(amountSats) / Number(UNITS_PER_COIN);
    return (fair * price.usd).toFixed(2);
  }, [amountSats]);

  const lengthForSizing = value.length > 0 ? value.length : 1;
  const amountFontSize = getAmountFontSize(lengthForSizing);
  const symbolFontSize = Math.round(amountFontSize * AMOUNT_SYMBOL_RATIO);

  return (
    <View className="items-center pt-4 pb-2">
      <View className="flex-row items-baseline justify-center w-full px-4">
        <Text
          className="text-primary mr-1"
          style={{
            fontFamily: FONT_PHUDU_LIGHT,
            fontSize: symbolFontSize,
            includeFontPadding: false,
          }}
          numberOfLines={1}
        >
          {COIN_SYMBOL}
        </Text>
        <AmountInput
          className="text-foreground flex-shrink"
          style={{
            fontFamily: FONT_PHUDU_BLACK,
            fontSize: amountFontSize,
            paddingVertical: 0,
            includeFontPadding: false,
          }}
          placeholder="0"
          placeholderTextColor={theme.colors.textSecondary}
          value={value}
          onValueChange={onValueChange}
          maxLength={20}
          numberOfLines={1}
        />
      </View>
      {usdEquivalent ? (
        <Text className="text-muted-foreground text-sm mt-2">
          {t("buy.usdApprox", { amount: usdEquivalent })}
        </Text>
      ) : null}
      {presets && presets.length > 0 ? (
        <View className="flex-row gap-2 mt-3">
          {presets.map((preset) => {
            const selected = value === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => onValueChange(preset)}
                className={`rounded-full px-4 py-2 ${
                  selected
                    ? "bg-primary/20 border border-primary"
                    : "bg-surface border border-transparent"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selected ? "text-primary" : "text-foreground"
                  }`}
                >
                  {preset}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
