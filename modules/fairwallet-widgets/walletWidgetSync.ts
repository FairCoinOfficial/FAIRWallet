/**
 * When the app should push a new snapshot to the home-screen widgets.
 *
 * THIS FILE IMPORTS NOTHING, and that is load-bearing rather than incidental:
 * the decision below is the part worth testing, and anything reaching the
 * native binding drags in `expo-modules-core` → `react-native`, whose Flow
 * syntax the test runner cannot parse. Keeping the rule pure is what lets it be
 * tested at all. The stateful wrapper that acts on it lives in `index.ts`,
 * beside the bridge it calls.
 *
 * Every write costs a DataStore commit and a recomposition of each placed
 * widget, so the app does not publish on every render. It publishes when what
 * the card DRAWS has changed — and it distinguishes two kinds of change,
 * because they do not deserve the same urgency:
 *
 *  - The MONEY (balance, pending, and which Pocket they belong to). If any of
 *    these moved, the number on the home screen is currently wrong. Written
 *    immediately, with no rate limit.
 *  - The TRIMMINGS (the quote, and the "as of" stamp on an otherwise identical
 *    balance). These refine a card that is already correct. Worth writing, but
 *    not worth a disk write every time the 60-second price poll ticks, so they
 *    are floored by {@link MIN_TRIMMING_WRITE_INTERVAL_MS}.
 *
 * The stamp is deliberately in the second group rather than dropped: for a
 * wallet whose background sync is a documented stub, "this was true 3 days ago"
 * against "true just now" is the most useful thing on the card even when the
 * balance behind it has not moved.
 */

/**
 * Floor between two writes that carry no change of money.
 *
 * Five minutes. The price poll runs once a minute while the app is open
 * (`PRICE_POLL_INTERVAL` in `src/services/price.ts`), and a home screen nobody
 * is looking at does not need a fresh stamp twelve times an hour. A real
 * balance change ignores this floor entirely.
 */
export const MIN_TRIMMING_WRITE_INTERVAL_MS = 5 * 60_000;

/** Everything the widgets draw, as the app knows it. */
export interface WalletWidgetSnapshot {
  /** Confirmed balance in satoshis, as a decimal string (the wallet's bigint). */
  balanceSats: string;
  /** Unconfirmed (mempool) balance in satoshis, same encoding. */
  pendingSats: string;
  /** The Pocket this balance belongs to. */
  pocketName: string;
  /** FAIR in USD; non-finite or non-positive means "no quote". */
  priceUsd: number;
  /** When the balance was true — the sync behind it, not the time of the call. */
  observedAtMs: number;
}

export interface WalletWidgetSyncDecision {
  next: WalletWidgetSnapshot;
  /** The snapshot last written, or `null` before the first. */
  last: WalletWidgetSnapshot | null;
  /** When that write happened; `null` before the first. */
  lastWrittenAtMs: number | null;
  nowMs: number;
}

/**
 * Whether any of the values that make the card's NUMBER right have changed.
 *
 * The Pocket belongs here rather than with the trimmings: switching Pocket
 * changes WHOSE money is on screen, which is the most misleading staleness this
 * widget can carry.
 */
function moneyChanged(next: WalletWidgetSnapshot, last: WalletWidgetSnapshot): boolean {
  return (
    next.balanceSats !== last.balanceSats ||
    next.pendingSats !== last.pendingSats ||
    next.pocketName !== last.pocketName
  );
}

/**
 * Whether anything the card draws has changed at all.
 *
 * The quote is compared with `Object.is` so that two non-quotes (both `NaN`)
 * compare equal — `NaN !== NaN` would otherwise report a change on every single
 * poll for a device that has never reached the price endpoint, which is exactly
 * the offline case where the extra writes are least affordable.
 */
function anythingChanged(next: WalletWidgetSnapshot, last: WalletWidgetSnapshot): boolean {
  return (
    moneyChanged(next, last) ||
    !Object.is(next.priceUsd, last.priceUsd) ||
    next.observedAtMs !== last.observedAtMs
  );
}

/** Whether this snapshot is worth writing. */
export function shouldWriteWalletWidgetSnapshot({
  next,
  last,
  lastWrittenAtMs,
  nowMs,
}: WalletWidgetSyncDecision): boolean {
  // Nothing has ever been published: the widgets are showing their empty state.
  if (last === null || lastWrittenAtMs === null) return true;

  // The number on the home screen is wrong. No floor applies.
  if (moneyChanged(next, last)) return true;

  if (!anythingChanged(next, last)) return false;

  return nowMs - lastWrittenAtMs >= MIN_TRIMMING_WRITE_INTERVAL_MS;
}
