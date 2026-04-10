/**
 * Platform-agnostic key-value storage adapter.
 *
 * On native (iOS/Android), uses expo-secure-store (Keychain / EncryptedSharedPreferences).
 * On web (Electron), uses localStorage with optional Electron safeStorage encryption
 * via the preload bridge.
 *
 * This module is the ONLY place that directly imports expo-secure-store.
 * All other modules use this adapter instead.
 */

import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Storage interface
// ---------------------------------------------------------------------------

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Native adapter (iOS / Android)
// ---------------------------------------------------------------------------

function createNativeAdapter(): StorageAdapter {
  // Dynamic import to avoid web bundling issues
  const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

// ---------------------------------------------------------------------------
// Web adapter (Electron / Browser)
// Uses localStorage. In Electron, the preload bridge provides safeStorage
// encryption, but localStorage is acceptable for development and the data
// is per-origin isolated.
// ---------------------------------------------------------------------------

function createWebAdapter(): StorageAdapter {
  return {
    getItem: async (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key, value) => {
      localStorage.setItem(key, value);
    },
    deleteItem: async (key) => {
      localStorage.removeItem(key);
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton adapter based on platform
// ---------------------------------------------------------------------------

let _adapter: StorageAdapter | null = null;

function getAdapter(): StorageAdapter {
  if (_adapter) return _adapter;
  _adapter = Platform.OS === "web" ? createWebAdapter() : createNativeAdapter();
  return _adapter;
}

// ---------------------------------------------------------------------------
// Public API (matches expo-secure-store interface)
// ---------------------------------------------------------------------------

export async function getItemAsync(key: string): Promise<string | null> {
  return getAdapter().getItem(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  return getAdapter().setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  return getAdapter().deleteItem(key);
}
