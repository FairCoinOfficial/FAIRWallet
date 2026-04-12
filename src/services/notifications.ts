/**
 * Local notification service for incoming transactions.
 *
 * Uses `expo-notifications` to schedule a local notification when a new
 * received transaction is detected. Works in the foreground (via the
 * notification handler) and triggers instantly when scheduled from the
 * background sync task.
 *
 * A single "transactions" channel is created on Android with the bundled
 * `received` sound. iOS has no channels; the notification itself opts into
 * the default system sound.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { t } from "../i18n";
import { COIN_TICKER } from "../core/branding";
import { formatFair } from "../core/format-amount";

const TRANSACTIONS_CHANNEL_ID = "transactions";

let initPromise: Promise<void> | null = null;

/**
 * Idempotent notification setup. Asks for permission, configures the Android
 * channel, and installs the foreground notification handler. Safe to call
 * multiple times — subsequent calls await the same promise.
 */
export function initNotifications(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const settings = await Notifications.getPermissionsAsync();
      if (!settings.granted) {
        await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: false,
            allowSound: true,
          },
        });
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(
          TRANSACTIONS_CHANNEL_ID,
          {
            name: "Transactions",
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: "received",
            vibrationPattern: [0, 250, 250, 250],
            enableVibrate: true,
          },
        );
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      // Notification subsystem unavailable (web/electron without the native
      // module, user revoked permission, etc). We still resolve so callers
      // don't block — the underlying schedule calls will fail silently.
    }
  })();
  return initPromise;
}

/**
 * Schedule an immediate local notification announcing a received payment.
 *
 * `amountValue` is the raw bigint amount in smallest units (m⊜). It is
 * formatted via `formatFair` for display.
 */
export async function scheduleReceivedNotification(
  amountValue: bigint,
): Promise<void> {
  await initNotifications();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t("notifications.received.title"),
        body: t("notifications.received.body", {
          amount: formatFair(amountValue),
          ticker: COIN_TICKER,
        }),
        sound: "default",
      },
      // `null` trigger fires the notification immediately.
      trigger: null,
    });
  } catch {
    // Scheduling failed (no permission, web fallback, etc). Sound playback
    // via `src/services/sounds.ts` still covers the foreground case.
  }
}
