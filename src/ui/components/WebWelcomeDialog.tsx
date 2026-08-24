/**
 * One-time welcome dialog for the browser build (wallet.fairco.in).
 *
 * The web bundle is the same wallet as the native app, but its at-rest
 * container is not: `kv-store` falls back to plaintext `localStorage` in a
 * plain browser because there is no OS keychain to reach — no Keychain /
 * EncryptedSharedPreferences, no biometric unlock, and clearing site data
 * destroys the wallet. That is a real difference in custody, so the browser
 * says it out loud once, on first visit, and points at the native builds.
 *
 * Electron ships the SAME web bundle but reaches the OS keychain through its
 * preload bridge and IS the native desktop app, so the warning would be wrong
 * there — hence the `electronAPI` check rather than a bare `Platform.OS`
 * test.
 */

import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Dialog } from "@oxyhq/bloom/dialog";
import { useTheme } from "@oxyhq/bloom/theme";
import { t } from "../../i18n";
import { getItemAsync, setItemAsync } from "../../storage/kv-store";

const SEEN_KEY = "fairwallet_web_welcome_seen";

const DOWNLOAD_URL = "https://fairco.in/wallet";

/**
 * True only in a plain browser tab. Electron's renderer is also
 * `Platform.OS === "web"`, but it exposes the preload bridge, and it is the
 * desktop app this dialog would otherwise be recommending.
 */
const isBrowser =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  !("electronAPI" in window);

// Kick the storage round-trip off at module scope, like the root layout does
// for the theme, so the flag is already in flight before the first render.
const seenPromise = isBrowser
  ? getItemAsync(SEEN_KEY).catch(() => null)
  : Promise.resolve("1");

const CAVEATS = [
  "webWelcome.caveat.storage",
  "webWelcome.caveat.lock",
  "webWelcome.caveat.siteData",
] as const;

export function WebWelcomeDialog() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isBrowser) return;
    let active = true;
    seenPromise.then((seen) => {
      if (active && seen === null) setOpen(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    void setItemAsync(SEEN_KEY, "1");
  }, []);

  const openDownloads = useCallback(() => {
    void Linking.openURL(DOWNLOAD_URL);
  }, []);

  if (!isBrowser) return null;

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      placement={{ base: "bottom", md: "center" }}
      title={t("webWelcome.title")}
      description={t("webWelcome.description")}
      actions={[
        { label: t("webWelcome.getApp"), onPress: openDownloads },
        { label: t("webWelcome.continue"), color: "cancel" },
      ]}
    >
      <View className="gap-3 mt-2">
        {CAVEATS.map((key) => (
          <View key={key} className="flex-row gap-2.5">
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text className="text-muted-foreground text-sm flex-1">
              {t(key)}
            </Text>
          </View>
        ))}
      </View>
    </Dialog>
  );
}
