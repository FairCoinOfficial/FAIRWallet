package fairco.wallet.widgets

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.util.Currency
import java.util.Locale

/**
 * How the widgets turn stored values into the strings a reader sees.
 *
 * All of it is pure and takes its [Locale] and [ZoneId] as arguments rather than
 * reading the default, which is what makes it testable on a plain JVM — and
 * testable is the point, because these are the rules that are wrong in ways
 * nobody notices: a balance that reads differently on the home screen than it
 * does in the app, or a stamp that says "14:32" about yesterday.
 *
 * The formatting MIRRORS the app deliberately. `formatFairAmount` and
 * `formatFiatAmount` in `src/i18n/index.ts` are the reference, and the widget
 * exists beside the app rather than instead of it — a number that disagrees
 * with the one inside the app is worse than no widget.
 */

/** Satoshis per FAIR: `UNITS_PER_COIN` in `@fairco.in/core`, as a decimal shift. */
private const val FAIR_DECIMAL_PLACES = 8

/**
 * Fraction digits on a FAIR amount.
 *
 * Two to eight, exactly as `formatFairAmount` asks `Intl.NumberFormat` for: a
 * whole number of coins still reads "12.00" rather than "12", and a dusty
 * balance keeps every satoshi it has rather than being rounded into looking
 * round. At eight places no rounding can occur — a satoshi count shifted eight
 * places is exact — so the rounding mode below never applies here.
 */
private const val FAIR_MIN_FRACTION_DIGITS = 2
private const val FAIR_MAX_FRACTION_DIGITS = 8

/** Fiat is always two places, as `formatFiatAmount` asks for. */
private const val FIAT_FRACTION_DIGITS = 2

/**
 * The currency the fiat line is quoted in.
 *
 * USD, unconditionally, and NOT the user's `fairwallet_currency` preference.
 * The only quote that exists is FAIR→USD (the Explorer's `/api/price`, sourced
 * from WFAIR on Base) and the app carries no FX rate, which is why both places
 * it renders a fiat figure — `BalanceDisplay.tsx` and `PriceSparkline.tsx` —
 * hardcode USD too. Honouring the preference here would put a euro sign in
 * front of a dollar figure.
 */
private const val FIAT_CURRENCY_CODE = "USD"

/** [sats] as a FAIR amount, formatted the way the app formats it. */
internal fun formatFairAmount(sats: BigInteger, locale: Locale): String {
    val format = NumberFormat.getNumberInstance(locale).apply {
        minimumFractionDigits = FAIR_MIN_FRACTION_DIGITS
        maximumFractionDigits = FAIR_MAX_FRACTION_DIGITS
    }
    return format.format(BigDecimal(sats).movePointLeft(FAIR_DECIMAL_PLACES))
}

/**
 * [sats] valued at [priceUsd], or `null` when there is no usable quote.
 *
 * `BigDecimal` throughout rather than a double multiply: the app's own
 * `formatFairAmount` divides through `Number`, which is fine for the magnitudes
 * a wallet holds, but a widget has no reason to inherit a precision loss it can
 * trivially avoid, and the two agree at every value either will ever show.
 */
internal fun fiatValue(sats: BigInteger, priceUsd: Double?): BigDecimal? {
    val quote = usableQuote(priceUsd) ?: return null
    return BigDecimal(sats)
        .movePointLeft(FAIR_DECIMAL_PLACES)
        .multiply(BigDecimal.valueOf(quote))
}

/**
 * [amount] as a fiat string.
 *
 * `HALF_UP` rather than Java's default `HALF_EVEN`, because `Intl.NumberFormat`
 * rounds half away from zero and the app's figures come from it. The difference
 * is one cent on an exact half, which is invisible until someone compares the
 * home screen against the wallet and finds them disagreeing.
 */
internal fun formatFiat(amount: BigDecimal, locale: Locale): String {
    val format = NumberFormat.getCurrencyInstance(locale).apply {
        currency = Currency.getInstance(FIAT_CURRENCY_CODE)
        minimumFractionDigits = FIAT_FRACTION_DIGITS
        maximumFractionDigits = FIAT_FRACTION_DIGITS
        roundingMode = RoundingMode.HALF_UP
    }
    return format.format(amount)
}

/**
 * Which shape the "as of" stamp takes.
 *
 * The stamp is the most important piece of chrome on an always-visible balance:
 * `src/services/background-sync.ts` is a documented stub, so nothing advances
 * the balance unless someone opens the app, and a number with no date on it
 * reads as live however old it is.
 */
internal enum class StampForm {
    /** Today — the time alone is unambiguous. */
    TIME_ONLY,

    /** Any other day, including tomorrow. The date has to be said. */
    DATE_AND_TIME,
}

/**
 * Which form the stamp for [observedAtMs] takes when read at [nowMs].
 *
 * The comparison is by CALENDAR DAY in [zone] rather than by elapsed hours.
 * "Today at 23:50" read at 00:10 is eleven hours from now by the clock but a
 * different date, and showing a bare time there is exactly the case where a
 * reader assumes the balance is current.
 *
 * A stamp in the FUTURE also gets the date. `System.currentTimeMillis` moves
 * backwards whenever the clock is corrected or a time zone changes, so this is
 * a case that occurs rather than a hypothetical, and a bare time from tomorrow
 * is the most confusing thing the card could show.
 */
internal fun stampForm(observedAtMs: Long, nowMs: Long, zone: ZoneId): StampForm {
    val observedDay = Instant.ofEpochMilli(observedAtMs).atZone(zone).toLocalDate()
    val today = Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()
    return if (observedDay == today) StampForm.TIME_ONLY else StampForm.DATE_AND_TIME
}
