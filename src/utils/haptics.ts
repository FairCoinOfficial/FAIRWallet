import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Light tap - for selections, toggles, digit presses */
export function hapticSelection(): void {
  if (Platform.OS === "web") return;
  Haptics.selectionAsync();
}

/** Success feedback - for completed transactions, successful auth */
export function hapticSuccess(): void {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Error feedback - for failed transactions, wrong PIN */
export function hapticError(): void {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Warning feedback - for dangerous actions, confirmations */
export function hapticWarning(): void {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Medium impact - for button presses */
export function hapticImpact(): void {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
