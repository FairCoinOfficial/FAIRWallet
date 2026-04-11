/**
 * Color preset bridge — imports Bloom's presets and adapts them
 * for FAIRWallet's theme system.
 *
 * Uses @oxyhq/bloom's `faircoin` preset as the default, and exposes
 * additional Bloom presets (oxy, green, blue, purple) as alternatives.
 *
 * Bloom presets use the same HSL CSS variable format that our Tailwind
 * config and global.css expect: `"H S% L%"` space-separated.
 */

import {
  APP_COLOR_PRESETS,
  type AppColorName,
  type AppColorPreset,
} from "@oxyhq/bloom/color-presets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Preset names available in FAIRWallet */
export type PresetName = "faircoin" | "oxy" | "green" | "blue" | "purple";

export interface ColorPreset {
  name: PresetName;
  label: string;
  swatch: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Bridge: Convert Bloom preset to FAIRWallet preset
// ---------------------------------------------------------------------------

function bloomToLocal(
  bloom: AppColorPreset,
  name: PresetName,
  label: string,
): ColorPreset {
  return {
    name,
    label,
    swatch: bloom.hex,
    light: bloom.light,
    dark: bloom.dark,
  };
}

// ---------------------------------------------------------------------------
// Preset registry
// ---------------------------------------------------------------------------

const presets: Record<PresetName, ColorPreset> = {
  faircoin: bloomToLocal(APP_COLOR_PRESETS.faircoin, "faircoin", "FairCoin"),
  oxy: bloomToLocal(APP_COLOR_PRESETS.oxy, "oxy", "Oxy"),
  green: bloomToLocal(APP_COLOR_PRESETS.green, "green", "Emerald"),
  blue: bloomToLocal(APP_COLOR_PRESETS.blue, "blue", "Ocean"),
  purple: bloomToLocal(APP_COLOR_PRESETS.purple, "purple", "Purple"),
};

/** Get a preset by name. Falls back to "faircoin" for unknown names. */
export function getPreset(name: PresetName): ColorPreset {
  return presets[name] ?? presets.faircoin;
}

/** All available preset names. */
export const presetNames: readonly PresetName[] = [
  "faircoin",
  "oxy",
  "green",
  "blue",
  "purple",
] as const;

/** All presets as an array (useful for rendering picker UIs). */
export function getAllPresets(): readonly ColorPreset[] {
  return presetNames.map((n) => presets[n]);
}
