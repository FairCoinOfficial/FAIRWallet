package fairco.wallet.widgets

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.math.BigInteger

/**
 * Reading what the app wrote.
 *
 * The store holds amounts as strings and the quote as a double, so every value
 * arrives as something that might not be what it claims. The rules below all
 * answer the same question — what does the card show when a value cannot be
 * trusted — and they answer it the same way each time: show LESS, never show a
 * wrong number. On a wallet, a plausible-looking wrong balance is far worse
 * than a visibly absent one.
 */
class WalletSnapshotTest {

    // ── Amounts ────────────────────────────────────────────────────────────

    @Test
    fun `a plain amount parses`() {
        assertEquals(BigInteger("1234500000"), parseAmount("1234500000"))
    }

    @Test
    fun `zero is a real balance, not a missing one`() {
        // The distinction the whole nullable return exists for: an empty wallet
        // shows "0.00", while an unreadable one shows the first-run state.
        assertEquals(BigInteger.ZERO, parseAmount("0"))
    }

    @Test
    fun `an amount too large for a Long survives`() {
        // Why the field is a BigInteger and crosses the bridge as a string.
        val huge = "92233720368547758070"
        assertEquals(BigInteger(huge), parseAmount(huge))
    }

    @Test
    fun `surrounding whitespace is tolerated`() {
        assertEquals(BigInteger("42"), parseAmount("  42  "))
    }

    @Test
    fun `an absent or empty amount is absent`() {
        assertNull(parseAmount(null))
        assertNull(parseAmount(""))
        assertNull(parseAmount("   "))
    }

    @Test
    fun `an unreadable amount is absent rather than zero`() {
        // Falling back to zero here would print "0.00 FAIR" on the home screen
        // of someone whose wallet is fine — the most alarming possible way to
        // be wrong.
        assertNull(parseAmount("not-a-number"))
        assertNull(parseAmount("12.5"))
        assertNull(parseAmount("1e9"))
        assertNull(parseAmount("0x10"))
    }

    @Test
    fun `a negative amount is rejected`() {
        // A UTXO wallet has no negative balance, so its arrival means the value
        // did not come from where we think it did. A minus sign in front of
        // someone's savings is not a good way to discover that.
        assertNull(parseAmount("-1"))
    }

    // ── The quote ──────────────────────────────────────────────────────────

    @Test
    fun `a real quote is usable`() {
        assertEquals(0.4908275003129989, usableQuote(0.4908275003129989)!!, 0.0)
    }

    @Test
    fun `every flavour of no-quote is rejected`() {
        // The JS side documents any non-positive value as "no quote", and the
        // app applies the same rule (`priceUsd == null || priceUsd === 0` in
        // BalanceDisplay). A fiat line reading "$0.00" beside a real balance
        // states something false rather than something missing.
        assertNull(usableQuote(null))
        assertNull(usableQuote(0.0))
        assertNull(usableQuote(-1.0))
        assertNull(usableQuote(Double.NaN))
        assertNull(usableQuote(Double.POSITIVE_INFINITY))
        assertNull(usableQuote(Double.NEGATIVE_INFINITY))
    }

    // ── What the card does with all that ───────────────────────────────────

    private fun snapshot(
        balance: BigInteger?,
        observedAtMs: Long,
    ) = WalletSnapshot(
        balanceSats = balance,
        pendingSats = BigInteger.ZERO,
        pocketName = "Everyday",
        priceUsd = 0.49,
        observedAtMs = observedAtMs,
    )

    @Test
    fun `a balance with a stamp is drawable`() {
        assert(snapshot(BigInteger.ZERO, 1_800_000_000_000).hasBalance)
    }

    @Test
    fun `a balance with no stamp is not drawable`() {
        // The stamp is what keeps an always-visible number honest, so a balance
        // we cannot date is not a card worth drawing — it would read as live
        // with nothing to say otherwise.
        assert(!snapshot(BigInteger.ONE, 0L).hasBalance)
    }

    @Test
    fun `no balance is not drawable however fresh the stamp`() {
        assert(!snapshot(null, 1_800_000_000_000).hasBalance)
    }
}
