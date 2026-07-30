import { requireOptionalNativeModule } from "expo-modules-core";

import {
  shouldWriteWalletWidgetSnapshot,
  type WalletWidgetSnapshot,
} from "./walletWidgetSync";

/**
 * JS side of FAIRWallet's Android home-screen widgets.
 *
 * The widgets render from a snapshot the APP writes, and never fetch anything
 * themselves. That is not a shortcut — it is the only honest design available
 * here, for two reasons found in the code rather than assumed:
 *
 *  - The balance is derived by the SPV state machine in `src/wallet`
 *    (`utxo-set.ts`, `apply-transaction.ts`, `reorg-rewind.ts`). Recomputing it
 *    in Kotlin would put a second definition of "how much money you have" in
 *    the codebase, and the two drifting apart shows up as a wrong number on
 *    someone's home screen.
 *  - Everything a widget would need to find the data on its own — the active
 *    wallet id, the Pocket, the display currency — lives in expo-secure-store,
 *    which is Keystore-wrapped and unreadable from a widget process. So a
 *    JS→widget write path has to exist regardless; carrying the balance on it
 *    too costs one more scalar.
 *
 * Everything crosses the bridge as a PLAIN SCALAR. An Expo Modules `Record` is
 * deliberately not used: it fails to convert in some consumer build
 * configurations ("cannot be cast to type … (received ReadableNativeMap)"), and
 * a bridge signature that works everywhere is worth more than a tidy one.
 *
 * Android-only by design (`expo-module.config.json` declares no other
 * platform), so the native module is absent on iOS, web and Electron. Every
 * call below no-ops there rather than throwing — a wallet must not fail to
 * show a balance because a home-screen widget is unavailable.
 */

interface FairWalletWidgetsNativeModule {
  setSnapshot(
    balanceSats: string,
    pendingSats: string,
    pocketName: string,
    priceUsd: number,
    observedAtMs: number,
  ): Promise<void>;
  clearSnapshot(): Promise<void>;
}

const nativeModule =
  requireOptionalNativeModule<FairWalletWidgetsNativeModule>("FairWalletWidgets");

/** Whether home-screen widgets exist on this platform at all. */
export const areWalletWidgetsSupported = nativeModule !== null;

/**
 * Publish what the widgets should draw.
 *
 * @param balanceSats   Confirmed balance in satoshis, as a DECIMAL STRING. A
 *                      string because the wallet holds these as `bigint` and
 *                      JS numbers lose precision above 2^53; the Kotlin side
 *                      parses to `BigInteger`. Same reason the `utxos` table
 *                      stores `value` as TEXT.
 * @param pendingSats   Unconfirmed (mempool) balance, same encoding. Drawn as
 *                      its own line, and only when non-zero — one number while
 *                      funds are in flight is a lie by omission.
 * @param pocketName    The Pocket this balance belongs to. Shown so a user with
 *                      several Pockets can tell which number they are reading.
 * @param priceUsd      FAIR in USD. Any non-finite or non-positive value means
 *                      "no quote", and the fiat line is dropped rather than
 *                      drawn as zero — the same rule `BalanceDisplay` applies
 *                      in the app (`priceUsd == null || priceUsd === 0`).
 *
 *                      There is no currency parameter, and that is deliberate.
 *                      The app stores a `fairwallet_currency` preference, but
 *                      both places that render a fiat figure — `BalanceDisplay`
 *                      and `PriceSparkline` — hardcode `"USD"`, because the
 *                      only quote that exists is FAIR→USD and the app carries
 *                      no FX rate to convert it. Mirroring the preference here
 *                      would let the widget label a USD figure "€".
 * @param observedAtMs  When this balance was TRUE — the sync that produced it,
 *                      not the moment of this call. The widget stamps it on the
 *                      card, and the fiat figure inherits it: a stale balance
 *                      times a live price is the one combination that looks
 *                      current and is not.
 */
export async function setWalletWidgetSnapshot(
  balanceSats: string,
  pendingSats: string,
  pocketName: string,
  priceUsd: number,
  observedAtMs: number,
): Promise<void> {
  if (nativeModule === null) return;
  await nativeModule.setSnapshot(
    balanceSats,
    pendingSats,
    pocketName,
    priceUsd,
    observedAtMs,
  );
}

/**
 * Forget the snapshot, and redraw whatever is placed.
 *
 * Called when the wallet is no longer the one the snapshot describes — a wallet
 * deleted, or the app reset. A widget left holding the last balance of a wallet
 * that no longer exists on this device is both wrong and a disclosure, so the
 * store is emptied rather than left to be overwritten by the next sync that may
 * never come.
 */
export async function clearWalletWidgetSnapshot(): Promise<void> {
  if (nativeModule === null) return;
  await nativeModule.clearSnapshot();
}

let lastSnapshot: WalletWidgetSnapshot | null = null;
let lastWrittenAtMs: number | null = null;

/**
 * Publish [snapshot] if {@link shouldWriteWalletWidgetSnapshot} says it is
 * worth it.
 *
 * This is what the app calls; it owns the bookkeeping that the pure rule in
 * `walletWidgetSync.ts` is given rather than keeps. The bookkeeping advances
 * only when a write is actually made, so a snapshot skipped for one reason
 * cannot suppress the next one for another.
 *
 * Failures are swallowed on purpose: a widget a few minutes behind is not worth
 * interrupting someone looking at their wallet, and the next sync writes again.
 */
export function syncWalletWidgets(
  snapshot: WalletWidgetSnapshot,
  nowMs: number = Date.now(),
): void {
  if (
    !shouldWriteWalletWidgetSnapshot({
      next: snapshot,
      last: lastSnapshot,
      lastWrittenAtMs,
      nowMs,
    })
  ) {
    return;
  }

  lastSnapshot = snapshot;
  lastWrittenAtMs = nowMs;

  void setWalletWidgetSnapshot(
    snapshot.balanceSats,
    snapshot.pendingSats,
    snapshot.pocketName,
    snapshot.priceUsd,
    snapshot.observedAtMs,
  ).catch(() => {
    // Nothing to do and nothing worth telling the user about: the widget keeps
    // drawing its last good snapshot until the next sync succeeds.
  });
}

/**
 * Forget the snapshot everywhere — the widgets' store and this module's
 * bookkeeping — and redraw whatever is placed.
 *
 * Called when the wallet the snapshot describes is gone: a wallet deleted, or
 * the app reset. Two things have to happen together, which is why this is one
 * function rather than two the caller must remember to pair:
 *
 *  - the store is emptied, because a widget left holding the last balance of a
 *    wallet that no longer exists on this device is both wrong and a
 *    disclosure;
 *  - the bookkeeping is cleared, or the first write for a NEW wallet whose
 *    balance happened to match the old one's would be suppressed as unchanged.
 */
export async function forgetWalletWidgets(): Promise<void> {
  lastSnapshot = null;
  lastWrittenAtMs = null;
  await clearWalletWidgetSnapshot();
}

export {
  MIN_TRIMMING_WRITE_INTERVAL_MS,
  shouldWriteWalletWidgetSnapshot,
  type WalletWidgetSnapshot,
} from "./walletWidgetSync";
