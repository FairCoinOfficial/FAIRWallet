package fairco.wallet.widgets

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.text.FontWeight
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

/**
 * The balance card's MEASUREMENTS, and what fits at a given size.
 *
 * Everything here is decided without a `Context`, a `Canvas` or a composition,
 * which is the point: Glance emits `RemoteViews`, which the launcher measures in
 * its own process long after this code has run, so nothing can ask how tall a
 * line actually came out. What fits is therefore ESTIMATED — and an estimate
 * that is wrong is wrong silently, on someone's home screen, at a size nobody
 * tested. So the estimate is a pure function with unit tests rather than a
 * sequence of `if` statements inside a composable.
 *
 * The card is designed to SHED rather than squeeze. As the placement shrinks,
 * whole elements drop in a fixed priority order (see [balanceCardContent]); no
 * element is ever scaled down to make room for another.
 */

internal object WalletWidgetDimensions {
    /** Padding inside the card. Material 3's card content padding. */
    val PADDING = 16.dp

    /** …and the step down for a placement too short to spend 32dp on margins. */
    val PADDING_COMPACT = 12.dp

    /** Gap between the card's stacked lines. */
    val LINE_SPACING = 4.dp

    /** Gap before a block that begins a new idea — the actions row. */
    val BLOCK_SPACING = 8.dp

    /**
     * The action buttons' tap target: Material's 48dp minimum.
     *
     * Stated once here because the card's height budget is derived from it, and
     * a button that disagreed with the budget would be clipped rather than
     * dropped — the one failure mode this file exists to prevent.
     */
    val ACTION_SIZE = 48.dp

    /** Gap between the two action buttons. */
    val ACTION_SPACING = 8.dp

    /**
     * Height the LAUNCHER keeps for itself, taken off before anything is laid
     * out.
     *
     * `LocalSize` is not the height available to lay out in: the host reserves a
     * few dp of its own chrome and no API reports how much. Measured on a real
     * launcher, a 28dp element rendered at 24.3dp — about 12% — so this is a
     * flat reservation generous enough to cover it at the sizes this widget is
     * placed at, subtracted ONCE, here, rather than by each caller guessing.
     */
    val HOST_CHROME_RESERVE = 8.dp
}

/**
 * Font sizes, in sp, as plain numbers.
 *
 * They are numbers rather than `TextStyle`s because the fit calculation has to
 * MEASURE with them before anything is emitted, and a measurement taken against
 * a different size than the one drawn is a layout that silently disagrees with
 * itself. [WalletWidgetTextStyles] builds every style from these same values.
 */
internal object WalletWidgetFontSizes {
    /** The balance itself — M3 Display Small, the emphasised element. */
    const val BALANCE = 30f

    /** …and the step down where a wide placement is short. */
    const val BALANCE_COMPACT = 24f

    /** M3 Label Medium: the Pocket name above the balance. */
    const val POCKET = 12f

    /** M3 Title Small: the fiat line under the balance. */
    const val FIAT = 14f

    /** M3 Label Medium: money in flight. */
    const val PENDING = 13f

    /** M3 Label Small: the "as of" stamp, the quietest thing on the card. */
    const val STAMP = 11f

    /** M3 Title Medium: the first-run message. */
    const val EMPTY = 16f
}

/**
 * The type scale, as Material 3 roles.
 *
 * Built from [WalletWidgetFontSizes] rather than from literals, so the sizes the
 * fit calculation measures with and the sizes the card draws with cannot drift.
 * Colour is a parameter because the same role is drawn on two different
 * containers depending on the widget.
 */
internal object WalletWidgetTextStyles {
    /**
     * The balance — the emphasised element, and the reason Material 3
     * Expressive reads on a surface that cannot animate: emphasis here is size
     * and weight, not motion.
     */
    fun balance(color: ColorProvider, fontSizeSp: Float) = TextStyle(
        color = color,
        fontWeight = FontWeight.Bold,
        fontSize = fontSizeSp.sp,
    )

    /** The Pocket's name, above the balance. */
    fun pocket(color: ColorProvider) = TextStyle(
        color = color,
        fontWeight = FontWeight.Medium,
        fontSize = WalletWidgetFontSizes.POCKET.sp,
    )

    /** The fiat line. */
    fun fiat(color: ColorProvider) = TextStyle(
        color = color,
        fontWeight = FontWeight.Medium,
        fontSize = WalletWidgetFontSizes.FIAT.sp,
    )

    /** Money in flight. */
    fun pending(color: ColorProvider) = TextStyle(
        color = color,
        fontWeight = FontWeight.Medium,
        fontSize = WalletWidgetFontSizes.PENDING.sp,
    )

    /** The "as of" stamp — quiet, but never absent. */
    fun stamp(color: ColorProvider) = TextStyle(
        color = color,
        fontWeight = FontWeight.Normal,
        fontSize = WalletWidgetFontSizes.STAMP.sp,
    )

    /** The first-run message. */
    fun empty(color: ColorProvider) = TextStyle(
        color = color,
        fontWeight = FontWeight.Medium,
        fontSize = WalletWidgetFontSizes.EMPTY.sp,
    )

    /** An action button's label. */
    fun action(color: ColorProvider) = TextStyle(
        color = color,
        fontWeight = FontWeight.Medium,
        fontSize = WalletWidgetFontSizes.FIAT.sp,
    )
}

/**
 * Height one line of text occupies, as a fraction of its font size.
 *
 * A `TextView` reserves ascent plus descent INCLUDING the font's own padding
 * (`includeFontPadding`, on by default and not reachable from Glance), which for
 * Roboto is a little over 1.28em rather than the 1.17em its bare ascent and
 * descent come to. 1.3 is that rounded up.
 *
 * Erring HIGH is the safe direction here, and it is the opposite of the safe
 * direction for a text-length estimate: over-estimating a line's height drops an
 * element that would just have fitted, while under-estimating clips one that did
 * not. A dropped element looks deliberate; a clipped one looks broken.
 */
private const val LINE_HEIGHT_RATIO = 1.3f

/** Roughly how tall one line of [fontSizeSp] renders, in dp, at [fontScale]. */
internal fun lineHeightDp(fontSizeSp: Float, fontScale: Float): Dp {
    val scale = if (fontScale > 0f) fontScale else 1f
    return (fontSizeSp * scale * LINE_HEIGHT_RATIO).dp
}

/** What the balance card is drawing. */
internal data class BalanceCardContent(
    val compact: Boolean,
    val showsPocket: Boolean,
    val showsFiat: Boolean,
    val showsPending: Boolean,
    val showsActions: Boolean,
) {
    /**
     * How many optional elements survived.
     *
     * Used to choose between the two type scales, and it is a fair comparison
     * precisely because both scales add elements in the same priority order —
     * so an equal count is an equal SET, not merely an equal number.
     */
    val elementCount: Int
        get() = listOf(showsPocket, showsFiat, showsPending, showsActions).count { it }

    /** The balance and the stamp are not in here: both are always drawn. */
    val padding: Dp
        get() = if (compact) {
            WalletWidgetDimensions.PADDING_COMPACT
        } else {
            WalletWidgetDimensions.PADDING
        }

    val balanceFontSize: Float
        get() = if (compact) {
            WalletWidgetFontSizes.BALANCE_COMPACT
        } else {
            WalletWidgetFontSizes.BALANCE
        }
}

/**
 * What fits on a card of [height], given whether there is money in flight.
 *
 * ELEMENTS ARE ADDED IN PRIORITY ORDER while the budget lasts, and the order is
 * the argument this function is really making:
 *
 *  1. THE BALANCE and THE STAMP, together, are the floor — neither is optional
 *     at any size. An always-visible balance with no date on it reads as live
 *     however old it is, and this wallet's background sync is a documented stub,
 *     so the stamp is what keeps the number honest rather than decorating it.
 *  2. PENDING, when there is any. Money in flight changes what the balance
 *     MEANS, so it outranks everything below it — a card that had room for a
 *     shortcut but not for "+2.5 arriving" would be showing the less important
 *     of the two.
 *  3. THE POCKET, which says whose money this is. Above the fiat line because a
 *     user with several Pockets reading the wrong one's balance is a worse
 *     failure than not knowing what it is worth.
 *  4. THE FIAT LINE.
 *  5. THE ACTIONS. Last because the app is one tap away on the card itself —
 *     the whole card opens the wallet — so losing the shortcuts costs a tap,
 *     while losing anything above costs correctness.
 *
 * [fontScale] is a parameter rather than an assumption because a reader on a
 * large font setting is exactly the reader who cannot afford a clipped line.
 */
internal fun balanceCardContent(
    height: Dp,
    hasPending: Boolean,
    fontScale: Float,
): BalanceCardContent {
    // BOTH type scales are costed, and the one that shows MORE wins.
    //
    // A plain height threshold was the obvious approach and it was wrong: the
    // full scale spends more on padding and on the balance itself, so crossing
    // the threshold upwards could push an element out — a card that LOST its
    // Pocket line when the user made it taller. Choosing by what survives makes
    // that impossible, because both scales add elements in the same priority
    // order and each one's element count only grows with height.
    //
    // Ties go to the full scale: where the two show the same thing, the larger
    // balance is the better card.
    val full = costContent(height, hasPending, fontScale, compact = false)
    val compact = costContent(height, hasPending, fontScale, compact = true)
    return if (full.elementCount >= compact.elementCount) full else compact
}

private fun costContent(
    height: Dp,
    hasPending: Boolean,
    fontScale: Float,
    compact: Boolean,
): BalanceCardContent {
    val padding = if (compact) {
        WalletWidgetDimensions.PADDING_COMPACT
    } else {
        WalletWidgetDimensions.PADDING
    }
    val balanceFontSize = if (compact) {
        WalletWidgetFontSizes.BALANCE_COMPACT
    } else {
        WalletWidgetFontSizes.BALANCE
    }

    // The launcher's own chrome comes off first, then the card's padding. What
    // is left is everything the content may spend.
    val usable = height -
        WalletWidgetDimensions.HOST_CHROME_RESERVE -
        padding * 2

    // The floor: the balance and its stamp, which no size drops.
    val floor = lineHeightDp(balanceFontSize, fontScale) +
        WalletWidgetDimensions.LINE_SPACING +
        lineHeightDp(WalletWidgetFontSizes.STAMP, fontScale)

    // The optional elements, most important first, and only the ones that APPLY
    // — the pending line is absent rather than unaffordable when there is
    // nothing in flight, so its room is genuinely freed for the next element
    // down rather than reserved for a line that will not be drawn.
    val candidates = buildList {
        if (hasPending) {
            add(
                WalletWidgetDimensions.LINE_SPACING +
                    lineHeightDp(WalletWidgetFontSizes.PENDING, fontScale),
            )
        }
        add(
            WalletWidgetDimensions.LINE_SPACING +
                lineHeightDp(WalletWidgetFontSizes.POCKET, fontScale),
        )
        add(
            WalletWidgetDimensions.LINE_SPACING +
                lineHeightDp(WalletWidgetFontSizes.FIAT, fontScale),
        )
        add(WalletWidgetDimensions.BLOCK_SPACING + WalletWidgetDimensions.ACTION_SIZE)
    }

    // STRICT PRIORITY: the card takes the longest PREFIX of that list which
    // fits, and stops at the first element it cannot afford rather than
    // skipping it and trying the next.
    //
    // Skipping was the obvious behaviour and it was wrong twice over. It let a
    // less important element take the room of a more important one — a card with
    // no space for "+2.5 arriving" would spend it on the Pocket label instead,
    // which is precisely backwards. And because affording the pending line
    // displaced the Pocket, growing the widget could swap one for the other:
    // an element VANISHING as the card got taller. A prefix cannot do either,
    // and it makes the surviving set a function of how many fit, which is what
    // lets the two type scales be compared by count at all.
    var spent = floor
    var kept = 0
    for (cost in candidates) {
        if (spent + cost > usable) break
        spent += cost
        kept += 1
    }

    // Read back off the prefix, in the same order it was built.
    var index = 0
    val showsPending = if (hasPending) (kept > index).also { index += 1 } else false
    val showsPocket = (kept > index).also { index += 1 }
    val showsFiat = (kept > index).also { index += 1 }
    val showsActions = kept > index

    return BalanceCardContent(
        compact = compact,
        showsPocket = showsPocket,
        showsFiat = showsFiat,
        showsPending = showsPending,
        showsActions = showsActions,
    )
}
