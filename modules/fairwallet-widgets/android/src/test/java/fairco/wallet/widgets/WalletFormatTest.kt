package fairco.wallet.widgets

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.math.BigInteger
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Locale

/**
 * How stored values become the strings a reader sees.
 *
 * The formatting mirrors the app's (`formatFairAmount` / `formatFiatAmount` in
 * `src/i18n/index.ts`) on purpose: the widget sits BESIDE the wallet, and a
 * balance that reads differently in the two places is worse than no widget. The
 * cases below are the ones where the two could plausibly diverge.
 *
 * Every test passes an explicit [Locale] and [ZoneId] — a test that used the
 * machine's defaults would pass or fail depending on where it ran.
 */
class WalletFormatTest {

    private val us = Locale.US
    private val utc = ZoneId.of("UTC")

    private fun sats(value: String) = BigInteger(value)

    // ── FAIR amounts ───────────────────────────────────────────────────────

    @Test
    fun `a whole number of coins keeps two decimal places`() {
        // `minimumFractionDigits: 2` in the app. "12" would read as a count of
        // something rather than an amount of money.
        assertEquals("12.00", formatFairAmount(sats("1200000000"), us))
    }

    @Test
    fun `a dusty balance keeps every satoshi`() {
        // `maximumFractionDigits: 8`. Rounding here would show a balance the
        // wallet cannot spend down to.
        assertEquals("12.34567891", formatFairAmount(sats("1234567891"), us))
    }

    @Test
    fun `trailing zeroes past the second place are dropped`() {
        assertEquals("12.50", formatFairAmount(sats("1250000000"), us))
    }

    @Test
    fun `one satoshi is not rounded away to zero`() {
        // The smallest non-zero balance that exists. Showing "0.00" for money
        // someone holds is the worst rounding error this widget could make.
        assertEquals("0.00000001", formatFairAmount(sats("1"), us))
    }

    @Test
    fun `zero formats as zero rather than empty`() {
        assertEquals("0.00", formatFairAmount(BigInteger.ZERO, us))
    }

    @Test
    fun `thousands are grouped`() {
        assertEquals("1,234,567.00", formatFairAmount(sats("123456700000000"), us))
    }

    @Test
    fun `grouping and the decimal mark follow the locale`() {
        // German swaps both. A widget renders in the SYSTEM locale, which is not
        // necessarily the app's, so this is a real case rather than a hypothetical.
        assertEquals("1.234.567,00", formatFairAmount(sats("123456700000000"), Locale.GERMANY))
    }

    @Test
    fun `a balance larger than a double can hold exactly is still exact`() {
        // Above 2^53 satoshis a double loses whole units. This is why the value
        // crosses the bridge as a string and is held as a BigInteger.
        val huge = sats("9007199254740993")
        assertEquals("90,071,992.54740993", formatFairAmount(huge, us))
    }

    // ── Fiat ───────────────────────────────────────────────────────────────

    @Test
    fun `fiat is the balance times the quote`() {
        val value = fiatValue(sats("200000000"), 0.4908275003129989)

        assertNotNull(value)
        assertEquals(0.9816550006, requireNotNull(value).toDouble(), 1e-9)
    }

    @Test
    fun `no quote means no fiat value at all`() {
        // Each of these is "we do not know what this is worth", and none of them
        // may become "$0.00" — that would state something false.
        assertNull(fiatValue(sats("200000000"), null))
        assertNull(fiatValue(sats("200000000"), 0.0))
        assertNull(fiatValue(sats("200000000"), -1.0))
        assertNull(fiatValue(sats("200000000"), Double.NaN))
        assertNull(fiatValue(sats("200000000"), Double.POSITIVE_INFINITY))
    }

    @Test
    fun `fiat formats as currency with two places`() {
        assertEquals("$12.35", formatFiat(BigDecimal("12.345"), us))
    }

    @Test
    fun `fiat rounds half away from zero, as Intl does`() {
        // Java's default is HALF_EVEN, which would give "$12.34" here and make
        // the widget disagree with the app by a cent.
        assertEquals("$12.35", formatFiat(BigDecimal("12.345"), us))
        assertEquals("$12.36", formatFiat(BigDecimal("12.355"), us))
    }

    @Test
    fun `fiat is quoted in USD even in a locale with another currency`() {
        // The only quote that exists is FAIR->USD, and the app hardcodes USD at
        // both of its own fiat sites. A euro sign in front of a dollar figure is
        // the failure this pins.
        val formatted = formatFiat(BigDecimal("12.34"), Locale.GERMANY)

        assertTrue("expected a USD marker in \"$formatted\"", formatted.contains("$"))
    }

    // ── The "as of" stamp ──────────────────────────────────────────────────

    private fun atUtc(text: String): Long =
        ZonedDateTime.parse(text).toInstant().toEpochMilli()

    @Test
    fun `a balance observed today shows the time alone`() {
        val form = stampForm(
            observedAtMs = atUtc("2026-07-30T09:15:00Z"),
            nowMs = atUtc("2026-07-30T14:32:00Z"),
            zone = utc,
        )

        assertEquals(StampForm.TIME_ONLY, form)
    }

    @Test
    fun `a balance observed yesterday shows the date`() {
        val form = stampForm(
            observedAtMs = atUtc("2026-07-29T23:50:00Z"),
            nowMs = atUtc("2026-07-30T00:10:00Z"),
            zone = utc,
        )

        // Twenty minutes apart by the clock, but a different date. This is the
        // case a naive "less than 24 hours" rule gets wrong, and it is the case
        // where a bare time most convincingly reads as current.
        assertEquals(StampForm.DATE_AND_TIME, form)
    }

    @Test
    fun `an old balance shows the date`() {
        val form = stampForm(
            observedAtMs = atUtc("2026-07-01T09:00:00Z"),
            nowMs = atUtc("2026-07-30T09:00:00Z"),
            zone = utc,
        )

        assertEquals(StampForm.DATE_AND_TIME, form)
    }

    @Test
    fun `a stamp from the future shows the date`() {
        // `System.currentTimeMillis` moves backwards whenever the clock is
        // corrected, so this occurs. A bare time from tomorrow is the most
        // confusing thing the card could show.
        val form = stampForm(
            observedAtMs = atUtc("2026-07-31T10:00:00Z"),
            nowMs = atUtc("2026-07-30T10:00:00Z"),
            zone = utc,
        )

        assertEquals(StampForm.DATE_AND_TIME, form)
    }

    @Test
    fun `the day boundary is the reader's, not UTC's`() {
        val observed = atUtc("2026-07-30T23:30:00Z")
        val now = atUtc("2026-07-31T00:30:00Z")

        // The same pair of instants is two days apart in UTC and one day in a
        // zone an hour ahead, where both fall on the 31st.
        assertEquals(StampForm.DATE_AND_TIME, stampForm(observed, now, utc))
        assertEquals(
            StampForm.TIME_ONLY,
            stampForm(observed, now, ZoneId.of("Europe/Madrid")),
        )
    }
}
