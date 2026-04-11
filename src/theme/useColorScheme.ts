/**
 * Resolved color scheme hook.
 *
 * Combines the user's mode preference (dark/light/system) with the
 * OS-reported scheme from NativeWind and the active color preset.
 * Returns resolved HSL color values for imperative use (e.g. in
 * StyleSheet.create or navigation theme objects).
 */

import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { useThemeStore } from "./store";
import { getPreset } from "./presets";

interface ResolvedColors {
  background: string;
  foreground: string;
  surface: string;
  surfaceForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  destructiveForeground: string;
  accent: string;
  accentForeground: string;
  success: string;
  warning: string;
}

interface ColorSchemeResult {
  colorScheme: "dark" | "light";
  isDark: boolean;
  mode: "dark" | "light" | "system";
  preset: string;
  colors: ResolvedColors;
}

export function useColorScheme(): ColorSchemeResult {
  const { colorScheme: nativeScheme } = useNativeWindColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const preset = useThemeStore((s) => s.preset);

  const resolvedScheme: "dark" | "light" =
    mode === "system" ? (nativeScheme ?? "dark") : mode;

  const presetData = getPreset(preset);
  const tokens =
    resolvedScheme === "dark" ? presetData.dark : presetData.light;

  const colors: ResolvedColors = {
    background: `hsl(${tokens["--background"]})`,
    foreground: `hsl(${tokens["--foreground"]})`,
    surface: `hsl(${tokens["--surface"]})`,
    surfaceForeground: `hsl(${tokens["--surface-foreground"]})`,
    primary: `hsl(${tokens["--primary"]})`,
    primaryForeground: `hsl(${tokens["--primary-foreground"]})`,
    secondary: `hsl(${tokens["--secondary"]})`,
    secondaryForeground: `hsl(${tokens["--secondary-foreground"]})`,
    muted: `hsl(${tokens["--muted"]})`,
    mutedForeground: `hsl(${tokens["--muted-foreground"]})`,
    border: `hsl(${tokens["--border"]})`,
    input: `hsl(${tokens["--input"]})`,
    ring: `hsl(${tokens["--ring"]})`,
    destructive: `hsl(${tokens["--destructive"]})`,
    destructiveForeground: `hsl(${tokens["--destructive-foreground"]})`,
    accent: `hsl(${tokens["--accent"]})`,
    accentForeground: `hsl(${tokens["--accent-foreground"]})`,
    success: `hsl(${tokens["--success"]})`,
    warning: `hsl(${tokens["--warning"]})`,
  };

  return {
    colorScheme: resolvedScheme,
    isDark: resolvedScheme === "dark",
    mode,
    preset,
    colors,
  };
}
