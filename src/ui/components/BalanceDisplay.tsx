/**
 * BalanceDisplay — formatted balance with ⊜ symbol, fiat conversion, and 24h change.
 *
 * Follows Revolut's pattern: symbol + amount inline (e.g. "⊜ 1,234.56"),
 * with secondary currency below and a change badge.
 */

import { useMemo } from "react";
import { View, Text } from "react-native";
import { Badge } from "./Badge";

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

function formatFair(sats: bigint): string {
  const isNegative = sats < 0n;
  const absSats = isNegative ? -sats : sats;
  const whole = absSats / SATS_PER_FAIR;
  const fraction = absSats % SATS_PER_FAIR;

  // Format whole part with thousand separators
  const wholeStr = whole.toLocaleString();

  let result: string;
  if (fraction === 0n) {
    result = `${wholeStr}.00`;
  } else {
    const fracStr = fraction.toString().padStart(8, "0");
    // Show at least 2 decimals, trim trailing zeros beyond that
    const trimmed = fracStr.replace(/0+$/, "");
    const decimals = trimmed.length < 2 ? fracStr.slice(0, 2) : trimmed;
    result = `${wholeStr}.${decimals}`;
  }

  return isNegative ? `-${result}` : result;
}

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% today`;
}

function satsToUsd(sats: bigint, priceUsd: number): number {
  const fair = Number(sats) / Number(SATS_PER_FAIR);
  return fair * priceUsd;
}

// ---------------------------------------------------------------------------
// Size configs
// ---------------------------------------------------------------------------

const SIZE_PRIMARY: Record<BalanceSize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-[42px]",
};

const SIZE_SECONDARY: Record<BalanceSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

const SIZE_SYMBOL: Record<BalanceSize, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-[34px]",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BalanceDisplay({
  sats,
  priceUsd,
  change24h,
  size = "lg",
  showFiatPrimary = false,
}: BalanceDisplayProps) {
  const fairFormatted = useMemo(() => formatFair(sats), [sats]);

  const usdValue = useMemo(() => {
    if (priceUsd == null || priceUsd === 0) return null;
    return satsToUsd(sats, priceUsd);
  }, [sats, priceUsd]);

  const usdFormatted = useMemo(() => {
    if (usdValue === null) return null;
    return formatUsd(usdValue);
  }, [usdValue]);

  const changeInfo = useMemo(() => {
    if (change24h == null) return null;
    return {
      text: formatChange(change24h),
      variant: (change24h > 0 ? "success" : change24h < 0 ? "error" : "neutral") as
        "success" | "error" | "neutral",
    };
  }, [change24h]);

  const primaryClass = SIZE_PRIMARY[size];
  const secondaryClass = SIZE_SECONDARY[size];
  const symbolClass = SIZE_SYMBOL[size];

  // Fiat-primary mode (like Revolut showing $1,234.56 big)
  if (showFiatPrimary && usdFormatted !== null) {
    return (
      <View className="items-center">
        {/* Primary: $X,XXX.XX */}
        <View className="flex-row items-baseline">
          <Text className={`text-foreground ${symbolClass} font-light mr-0.5`}>
            $
          </Text>
          <Text className={`text-foreground ${primaryClass} font-bold tracking-tight`}>
            {usdFormatted}
          </Text>
        </View>

        {/* Secondary: ⊜ X,XXX.XX FAIR */}
        <Text className={`text-muted-foreground ${secondaryClass} mt-1`}>
          {FAIR_SYMBOL} {fairFormatted}
        </Text>

        {/* 24h change */}
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
      {/* Primary: ⊜ X,XXX.XX */}
      <View className="flex-row items-baseline">
        <Text className={`text-foreground ${symbolClass} font-light mr-1`}>
          {FAIR_SYMBOL}
        </Text>
        <Text className={`text-foreground ${primaryClass} font-bold tracking-tight`}>
          {fairFormatted}
        </Text>
      </View>

      {/* Secondary: ≈ $X.XX USD */}
      {usdFormatted !== null ? (
        <Text className={`text-muted-foreground ${secondaryClass} mt-1`}>
          {"\u2248"} ${usdFormatted} USD
        </Text>
      ) : null}

      {/* 24h change */}
      {changeInfo ? (
        <View className="mt-3">
          <Badge text={changeInfo.text} variant={changeInfo.variant} />
        </View>
      ) : null}
    </View>
  );
}
