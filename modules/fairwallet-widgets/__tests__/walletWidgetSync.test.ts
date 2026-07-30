/**
 * The write-or-skip decision behind the home-screen widgets.
 *
 * Every rule here is one that is invisible when it is wrong: too eager and the
 * app commits to disk and recomposes every placed widget once a minute; too shy
 * and someone's home screen shows a balance they no longer have. Neither shows
 * up in a screenshot, so both are pinned here.
 */

import { describe, test, expect } from "bun:test";
import {
  shouldWriteWalletWidgetSnapshot,
  MIN_TRIMMING_WRITE_INTERVAL_MS,
  type WalletWidgetSnapshot,
} from "../walletWidgetSync";

const BASE: WalletWidgetSnapshot = {
  balanceSats: "1234500000",
  pendingSats: "0",
  pocketName: "Everyday",
  priceUsd: 0.4908275003129989,
  observedAtMs: 1_800_000_000_000,
};

/** A time comfortably inside the trimming floor, and one comfortably past it. */
const INSIDE_FLOOR = 60_000;
const PAST_FLOOR = MIN_TRIMMING_WRITE_INTERVAL_MS + 1;

function decide(
  next: Partial<WalletWidgetSnapshot>,
  elapsedMs: number,
  last: WalletWidgetSnapshot = BASE,
): boolean {
  const writtenAt = BASE.observedAtMs;
  return shouldWriteWalletWidgetSnapshot({
    next: { ...BASE, ...next },
    last,
    lastWrittenAtMs: writtenAt,
    nowMs: writtenAt + elapsedMs,
  });
}

describe("shouldWriteWalletWidgetSnapshot", () => {
  test("writes when nothing has ever been published", () => {
    expect(
      shouldWriteWalletWidgetSnapshot({
        next: BASE,
        last: null,
        lastWrittenAtMs: null,
        nowMs: BASE.observedAtMs,
      }),
    ).toBe(true);
  });

  test("skips when nothing at all has changed", () => {
    expect(decide({}, PAST_FLOOR)).toBe(false);
  });

  // ── Money: written immediately, floor ignored ──────────────────────────────

  test("writes a changed balance immediately, inside the floor", () => {
    // The whole point of the exemption: the number on the home screen is wrong
    // right now, and waiting five minutes to correct it is not acceptable.
    expect(decide({ balanceSats: "999" }, INSIDE_FLOOR)).toBe(true);
  });

  test("writes a changed pending balance immediately", () => {
    expect(decide({ pendingSats: "250000000" }, INSIDE_FLOOR)).toBe(true);
  });

  test("writes a changed Pocket immediately", () => {
    // Switching Pocket changes whose money is on screen — the most misleading
    // staleness this widget can have.
    expect(decide({ pocketName: "Savings" }, INSIDE_FLOOR)).toBe(true);
  });

  // ── Trimmings: real changes, but floored ──────────────────────────────────

  test("holds a fresher stamp inside the floor", () => {
    expect(decide({ observedAtMs: BASE.observedAtMs + 1_000 }, INSIDE_FLOOR)).toBe(false);
  });

  test("writes a fresher stamp once past the floor", () => {
    // For a wallet whose background sync is a stub, "as of" is the most useful
    // thing on the card — it must not be pinned forever just because the
    // balance behind it has not moved.
    expect(decide({ observedAtMs: BASE.observedAtMs + 1_000 }, PAST_FLOOR)).toBe(true);
  });

  test("holds a moved quote inside the floor", () => {
    expect(decide({ priceUsd: 0.55 }, INSIDE_FLOOR)).toBe(false);
  });

  test("writes a moved quote once past the floor", () => {
    expect(decide({ priceUsd: 0.55 }, PAST_FLOOR)).toBe(true);
  });

  test("the floor is inclusive at exactly the interval", () => {
    expect(
      decide({ priceUsd: 0.55 }, MIN_TRIMMING_WRITE_INTERVAL_MS),
    ).toBe(true);
  });

  // ── The offline case ──────────────────────────────────────────────────────

  test("two absent quotes do not count as a change", () => {
    // `NaN !== NaN`, so a naive comparison reports a change on every poll for a
    // device that has never reached the price endpoint — the offline case,
    // where the wasted writes are least affordable.
    const withoutQuote = { ...BASE, priceUsd: Number.NaN };

    expect(
      shouldWriteWalletWidgetSnapshot({
        next: withoutQuote,
        last: withoutQuote,
        lastWrittenAtMs: BASE.observedAtMs,
        nowMs: BASE.observedAtMs + PAST_FLOOR,
      }),
    ).toBe(false);
  });

  test("losing a quote is still a change worth writing", () => {
    // Going from a real price to none drops the fiat line, which the card
    // draws — so it must not be swallowed by the NaN-equality rule above.
    expect(decide({ priceUsd: Number.NaN }, PAST_FLOOR)).toBe(true);
  });

  test("a balance change still wins when the quote is absent on both sides", () => {
    const withoutQuote = { ...BASE, priceUsd: Number.NaN };

    expect(
      shouldWriteWalletWidgetSnapshot({
        next: { ...withoutQuote, balanceSats: "1" },
        last: withoutQuote,
        lastWrittenAtMs: BASE.observedAtMs,
        nowMs: BASE.observedAtMs + INSIDE_FLOOR,
      }),
    ).toBe(true);
  });
});
