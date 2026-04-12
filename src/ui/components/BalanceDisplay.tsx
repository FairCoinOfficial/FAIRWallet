/**
 * BalanceDisplay — formatted balance with ⊜ symbol, fiat conversion, and 24h change.
 *
 * Uses Phudu font for all amounts (titles and numbers).
 * Follows Revolut's pattern: symbol + amount inline.
 */

import { useMemo } from "react";
import { View, Text } from "react-native";
import { Badge } from "./Badge";
import { formatFairAmount, formatFiatAmount } from "../../i18n";
import { FONT_PHUDU_LIGHT, FONT_PHUDU_BLACK } from "../../utils/fonts";

const SATS_PER_FAIR = 100_000_000n;
const FAIR_SYMBOL = "\u229C"; // ⊜

type BalanceSize = "sm" | "md" | "lg";

interface BalanceDisplayProps {
  sats: bigint;
  priceUsd?: number | null;
  change24h?: number | null;
  size?: BalanceSize;
  showFiatPrimary?: boolean;
}

function satsToUsd(sats: bigint, priceUsd: number): number {
  const fair = Number(sats) / Number(SATS_PER_FAIR);
  return fair * priceUsd;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% today`;
}

const SIZE_PRIMARY: Record<BalanceSize, number> = {
  sm: 20,
  md: 28,
  lg: 42,
};

const SIZE_SYMBOL: Record<BalanceSize, number> = {
  sm: 18,
  md: 24,
  lg: 34,
};

const SIZE_SECONDARY: Record<BalanceSize, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function BalanceDisplay({
  sats,
  priceUsd,
  change24h,
  size = "lg",
  showFiatPrimary = false,
}: BalanceDisplayProps) {
  const fairFormatted = useMemo(() => formatFairAmount(sats), [sats]);

  const usdValue = useMemo(() => {
    if (priceUsd == null || priceUsd === 0) return null;
    return satsToUsd(sats, priceUsd);
  }, [sats, priceUsd]);

  const usdFormatted = useMemo(() => {
    if (usdValue === null) return null;
    return formatFiatAmount(usdValue, "USD");
  }, [usdValue]);

  const changeInfo = useMemo(() => {
    if (change24h == null) return null;
    return {
      text: formatChange(change24h),
      variant: (change24h > 0 ? "success" : change24h < 0 ? "error" : "neutral") as
        "success" | "error" | "neutral",
    };
  }, [change24h]);

  const primary = SIZE_PRIMARY[size];
  const symbol = SIZE_SYMBOL[size];
  const secondary = SIZE_SECONDARY[size];

  // Fiat-primary mode
  if (showFiatPrimary && usdFormatted !== null) {
    return (
      <View className="items-center">
        <Text
          className="text-foreground tracking-tight"
          style={{ fontFamily: FONT_PHUDU_BLACK, fontSize: primary }}
        >
          {usdFormatted}
        </Text>

        <Text
          className="text-muted-foreground mt-1"
          style={{ fontFamily: FONT_PHUDU_LIGHT, fontSize: secondary }}
        >
          {FAIR_SYMBOL} {fairFormatted}
        </Text>

        {changeInfo ? (
          <View className="mt-3">
            <Badge text={changeInfo.text} variant={changeInfo.variant} />
          </View>
        ) : null}
      </View>
    );
  }

  // FAIR-primary mode (default)
  return (
    <View className="items-center">
      <View className="flex-row items-baseline">
        <Text
          className="text-foreground mr-1"
          style={{ fontFamily: FONT_PHUDU_LIGHT, fontSize: symbol }}
        >
          {FAIR_SYMBOL}
        </Text>
        <Text
          className="text-foreground tracking-tight"
          style={{ fontFamily: FONT_PHUDU_BLACK, fontSize: primary }}
        >
          {fairFormatted}
        </Text>
      </View>

      {usdFormatted !== null ? (
        <Text
          className="text-muted-foreground mt-1"
          style={{ fontSize: secondary }}
        >
          {"\u2248"} {usdFormatted}
        </Text>
      ) : null}

      {changeInfo ? (
        <View className="mt-3">
          <Badge text={changeInfo.text} variant={changeInfo.variant} />
        </View>
      ) : null}
    </View>
  );
}
