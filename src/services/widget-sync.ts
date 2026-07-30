/**
 * Keeps the Android home-screen widgets in step with the wallet.
 *
 * ONE subscription rather than a call at each place the balance changes. The
 * wallet publishes its balance from several paths — boot hydration, a receive,
 * a spend, a reorg rewind, a Pocket switch — and a widget that missed any of
 * them would show a stale number with a confident timestamp on it. Subscribing
 * to the store means a new path cannot forget to update the widget, because
 * there is nothing for it to remember.
 *
 * What crosses to the widget is exactly what the card draws: the balance,
 * anything pending, the Pocket's name, the quote, and WHEN the balance was
 * true. Nothing about addresses, transactions or counterparties — not because
 * those are more sensitive than the balance, but because the widget has no use
 * for them, and a snapshot holds whatever it is given for as long as the app is
 * installed.
 */

import { useWalletStore } from "../wallet/wallet-store";
import {
  forgetWalletWidgets,
  syncWalletWidgets,
  areWalletWidgetsSupported,
} from "../../modules/fairwallet-widgets";
import { getCachedPrice, subscribeToPrice } from "./price";

/**
 * The Pocket's display name for the account currently selected.
 *
 * Falls back to the wallet's name, and then to an empty string, which the card
 * simply omits — the label is context, and a card that invented one would be
 * worse than a card without it. A single-Pocket wallet still gets its wallet
 * name, which is what distinguishes two wallets on one device.
 */
function activePocketName(state: ReturnType<typeof useWalletStore.getState>): string {
  const pocket = state.pockets.find((entry) => entry.account === state.activeAccount);
  return pocket?.name ?? state.activeWalletName ?? "";
}

/**
 * Push the wallet's current state to the widgets.
 *
 * `observedAtMs` is `Date.now()` because this runs on the store update that
 * PUBLISHED the balance — the moment it became true is the moment we hear about
 * it. Reading a timestamp off the chain tip instead would date the balance to
 * the last block rather than to the sync that confirmed it, which is a
 * different and less useful claim.
 */
function publish(): void {
  const state = useWalletStore.getState();

  // Before the store has hydrated there is no balance to publish, only a zero
  // placeholder — and publishing that would put "0.00 FAIR" on a home screen
  // for a wallet that is merely still loading.
  if (!state.initialized) return;

  const price = getCachedPrice();

  syncWalletWidgets({
    balanceSats: state.confirmedBalance.toString(),
    pendingSats: state.unconfirmedBalance.toString(),
    pocketName: activePocketName(state),
    // `NaN` rather than 0 for "no quote": zero is a price, and the widget
    // treats any non-positive value as absent precisely so the two cannot be
    // confused.
    priceUsd: price?.usd ?? Number.NaN,
    observedAtMs: Date.now(),
  });
}

let started = false;

/**
 * Start mirroring the wallet to the widgets. Idempotent.
 *
 * Called once from the app's root layout. Returns without doing anything on a
 * platform with no widgets — iOS, web and Electron — so no caller needs to know
 * which platforms have them.
 */
export function startWalletWidgetSync(): void {
  if (started || !areWalletWidgetsSupported) return;
  started = true;

  // The store drives the important half. Zustand calls this on every state
  // change; `syncWalletWidgets` decides whether the change is worth a write, so
  // the noise is filtered there rather than by a narrower subscription here
  // that a future field could fall outside of.
  useWalletStore.subscribe(publish);

  // The quote moves independently of the wallet, and the fiat line is drawn
  // from it. Rate-limited downstream like everything else.
  subscribeToPrice(publish);

  // The store may already be hydrated by the time this runs — the root layout
  // mounts after a cold boot has restored it — so publish once immediately
  // rather than waiting for the next change, which on an idle wallet may never
  // come.
  publish();
}

/**
 * Clear the widgets, for when the wallet they describe is gone.
 *
 * Wired to wallet deletion and app reset — the two events that make the stored
 * snapshot describe an account this device no longer has. Locking is not one of
 * them: the wallet still holds that balance, so there is nothing to correct.
 */
export async function clearWalletWidgets(): Promise<void> {
  await forgetWalletWidgets();
}
