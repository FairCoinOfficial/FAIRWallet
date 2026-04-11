/**
 * Theme state store.
 *
 * Manages the active color mode (dark/light/system) and color preset.
 * Persists preferences to the platform KV store so they survive restarts.
 */

import { create } from "zustand";
import { getItemAsync, setItemAsync } from "../storage/kv-store";
import type { PresetName } from "./presets";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEY_MODE = "fairwallet_theme_mode";
const KEY_PRESET = "fairwallet_theme_preset";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColorMode = "dark" | "light" | "system";

interface ThemeState {
  /** Current color mode preference. */
  mode: ColorMode;
  /** Active color preset name. */
  preset: PresetName;
  /** Whether persisted preferences have been loaded. */
  hydrated: boolean;
  /** Update the color mode and persist it. */
  setMode: (mode: ColorMode) => void;
  /** Update the color preset and persist it. */
  setPreset: (preset: PresetName) => void;
  /** Load persisted preferences from storage. Call once at app start. */
  hydrate: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_MODES: ReadonlySet<string> = new Set<ColorMode>([
  "dark",
  "light",
  "system",
]);

const VALID_PRESETS: ReadonlySet<string> = new Set<PresetName>([
  "faircoin",
  "oxy",
  "green",
  "blue",
  "purple",
]);

function isValidMode(value: string | null): value is ColorMode {
  return value !== null && VALID_MODES.has(value);
}

function isValidPreset(value: string | null): value is PresetName {
  return value !== null && VALID_PRESETS.has(value);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "dark",
  preset: "faircoin",
  hydrated: false,

  setMode: (mode) => {
    set({ mode });
    setItemAsync(KEY_MODE, mode).catch(() => {
      // Persistence failure is non-fatal; the in-memory value is still set.
    });
  },

  setPreset: (preset) => {
    set({ preset });
    setItemAsync(KEY_PRESET, preset).catch(() => {
      // Persistence failure is non-fatal.
    });
  },

  hydrate: async () => {
    try {
      const [storedMode, storedPreset] = await Promise.all([
        getItemAsync(KEY_MODE),
        getItemAsync(KEY_PRESET),
      ]);

      set({
        mode: isValidMode(storedMode) ? storedMode : "dark",
        preset: isValidPreset(storedPreset) ? storedPreset : "faircoin",
        hydrated: true,
      });
    } catch {
      // Storage unavailable — keep defaults, mark as hydrated.
      set({ hydrated: true });
    }
  },
}));
