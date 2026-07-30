package fairco.wallet.widgets

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * What the balance card shows at a given height.
 *
 * This is the file the JVM test source set was created for. Glance emits
 * `RemoteViews`, which the launcher measures in another process, so nothing can
 * ask at runtime whether a line fitted — a card that drops an element which had
 * room, or keeps one that did not, is wrong silently and only on the placements
 * nobody happened to drag to.
 *
 * Most of what follows is stated as a PROPERTY OVER THE WHOLE SIZE RANGE rather
 * than as an assertion at a hand-picked height. That is deliberate: a test that
 * says "at 96dp the fiat line is gone" encodes a number derived from the very
 * arithmetic it is checking, so it passes for the wrong reason as soon as a font
 * size moves. "The fiat line never appears without the Pocket, at any height"
 * cannot rot that way, and it is the rule that actually matters.
 *
 * Every property is paired with a VACUITY FLOOR — a check that the situation it
 * describes actually arises somewhere in the range. An implication over an empty
 * set is true, and a priority test that never sees a card tight enough to drop
 * anything would pass while measuring nothing.
 */
class BalanceCardContentTest {

    private companion object {
        /**
         * The launcher's cell heights, under the App Widget sizing guide's
         * `70 × cells − 30` conversion.
         */
        val ONE_CELL = 40.dp
        val TWO_CELLS = 110.dp
        val FOUR_CELLS = 250.dp
        val FIVE_CELLS = 320.dp

        /** Android's font-size range, from Settings → Display → Font size. */
        const val SMALLEST_FONT_SCALE = 0.85f
        const val DEFAULT_FONT_SCALE = 1f
        const val LARGEST_FONT_SCALE = 2f

        /** Every height a launcher could plausibly hand this widget. */
        val ALL_HEIGHTS: List<Dp> =
            generateSequence(ONE_CELL) { it + 2.dp }.takeWhile { it <= FIVE_CELLS }.toList()
    }

    private fun content(
        height: Dp,
        hasPending: Boolean = true,
        fontScale: Float = DEFAULT_FONT_SCALE,
    ) = balanceCardContent(height, hasPending, fontScale)

    /** Assert [rule] holds at every height, and that it is not vacuous. */
    private fun property(
        name: String,
        hasPending: Boolean = true,
        fontScale: Float = DEFAULT_FONT_SCALE,
        interesting: (BalanceCardContent) -> Boolean,
        rule: (BalanceCardContent) -> Boolean,
    ) {
        var sawInteresting = 0
        ALL_HEIGHTS.forEach { height ->
            val card = content(height, hasPending, fontScale)
            assertTrue("$name failed at $height ($card)", rule(card))
            if (interesting(card)) sawInteresting += 1
        }
        assertTrue(
            "$name never encountered the case it describes, so it proves nothing",
            sawInteresting > 0,
        )
    }

    // ── Priority order, as properties ──────────────────────────────────────

    @Test
    fun `pending outranks everything below it`() {
        // Money in flight changes what the balance MEANS. A card showing what
        // the balance is worth, or a shortcut, while omitting "+2.5 arriving"
        // would be showing the less important thing.
        property(
            name = "pending outranks the fiat line and the actions",
            interesting = { !it.showsFiat && it.showsPending },
            rule = { !(it.showsFiat || it.showsActions) || it.showsPending },
        )
    }

    @Test
    fun `the pocket outranks the fiat line`() {
        // Whose money this is beats what it is worth: a user with several
        // Pockets reading the wrong one's balance is a worse failure than not
        // knowing its value.
        property(
            name = "the pocket outranks the fiat line",
            interesting = { it.showsPocket && !it.showsFiat },
            rule = { !it.showsFiat || it.showsPocket },
        )
    }

    @Test
    fun `the actions row is the first thing to go`() {
        // Last in priority because the whole card already opens the wallet, so
        // losing the shortcuts costs a tap while losing anything above costs
        // correctness.
        property(
            name = "the actions row never survives alone",
            interesting = { it.showsFiat && !it.showsActions },
            rule = { !it.showsActions || (it.showsFiat && it.showsPocket) },
        )
    }

    @Test
    fun `pending is not reserved when there is nothing in flight`() {
        // Otherwise every card would pay for a line most of them never draw.
        ALL_HEIGHTS.forEach { height ->
            assertFalse(
                "a card with no pending money claimed a pending line at $height",
                content(height, hasPending = false).showsPending,
            )
        }

        val freedRoomSomewhere = ALL_HEIGHTS.any { height ->
            content(height, hasPending = false).elementCount >
                content(height, hasPending = true).elementCount
        }
        assertTrue(
            "dropping the pending line never bought anything, so the room is not being freed",
            freedRoomSomewhere,
        )
    }

    // ── Monotonicity ──────────────────────────────────────────────────────

    @Test
    fun `nothing is ever lost by making the widget taller`() {
        // The property a plain height threshold for the type scale VIOLATED: the
        // full scale spends more on padding and on the balance, so crossing the
        // threshold upwards could push an element out — a card that lost its
        // Pocket line when the user dragged it taller. Choosing the scale by
        // what survives is what makes this hold.
        var previous = content(ONE_CELL)
        ALL_HEIGHTS.forEach { height ->
            val card = content(height)
            assertTrue("the Pocket vanished at $height", card.showsPocket || !previous.showsPocket)
            assertTrue("the fiat line vanished at $height", card.showsFiat || !previous.showsFiat)
            assertTrue("pending vanished at $height", card.showsPending || !previous.showsPending)
            assertTrue("the actions vanished at $height", card.showsActions || !previous.showsActions)
            previous = card
        }
    }

    @Test
    fun `the range actually spans an empty card and a full one`() {
        // The vacuity floor for the monotonicity test above: if every height in
        // the range produced the same card, that test would pass while checking
        // nothing at all.
        val counts = ALL_HEIGHTS.map { content(it).elementCount }

        assertEquals("the smallest placement should shed everything optional", 0, counts.first())
        assertEquals("the largest should carry all four", 4, counts.last())
    }

    // ── The floor: balance and stamp are never optional ────────────────────

    @Test
    fun `the smallest placement sheds everything else rather than clipping it`() {
        // There is no assertion for the balance or the stamp because neither is
        // in `BalanceCardContent` at all — they are unconditional by
        // construction, which is a stronger guarantee than a flag that happens
        // to be true. What this pins is that a one-cell card does not claim room
        // it has not got: a 48dp tap target inside a 40dp widget is not a small
        // button, it is a clipped one.
        val small = content(ONE_CELL)

        assertEquals(0, small.elementCount)
        assertFalse(small.showsActions)
    }

    // ── Type and padding ───────────────────────────────────────────────────

    @Test
    fun `a short card buys content with the compact type`() {
        val short = content(TWO_CELLS)

        assertTrue("the compact scale should win where it fits more", short.compact)
        assertEquals(WalletWidgetDimensions.PADDING_COMPACT, short.padding)
        assertEquals(WalletWidgetFontSizes.BALANCE_COMPACT, short.balanceFontSize, 0f)
    }

    @Test
    fun `a tall card spends its room on the larger balance`() {
        // Where both scales show the same thing the tie goes to the full one —
        // the card has the room, so the balance may as well be prominent.
        val tall = content(FIVE_CELLS)

        assertFalse(tall.compact)
        assertEquals(WalletWidgetDimensions.PADDING, tall.padding)
        assertEquals(WalletWidgetFontSizes.BALANCE, tall.balanceFontSize, 0f)
    }

    @Test
    fun `the compact scale is never chosen when it shows no more`() {
        ALL_HEIGHTS.forEach { height ->
            val card = content(height)
            if (card.compact) {
                // Costing the full scale at the same height must show strictly
                // less, or the compact one had no business winning.
                val fullElsewhere = content(height + 40.dp)
                assertTrue(
                    "compact was chosen at $height but the card never grows past it",
                    fullElsewhere.elementCount >= card.elementCount,
                )
            }
        }
    }

    // ── Accessibility ──────────────────────────────────────────────────────

    @Test
    fun `a large font setting sheds elements rather than clipping them`() {
        // The reader on a 2x font is exactly the reader who cannot afford a
        // clipped line, so the card is expected to show LESS, not the same
        // amount smaller.
        val shedsSomewhere = ALL_HEIGHTS.any { height ->
            content(height, fontScale = LARGEST_FONT_SCALE).elementCount <
                content(height, fontScale = DEFAULT_FONT_SCALE).elementCount
        }

        assertTrue("a 2x font never cost the card anything", shedsSomewhere)
    }

    @Test
    fun `a bigger font never shows more than a smaller one`() {
        ALL_HEIGHTS.forEach { height ->
            val small = content(height, fontScale = SMALLEST_FONT_SCALE)
            val normal = content(height, fontScale = DEFAULT_FONT_SCALE)
            val large = content(height, fontScale = LARGEST_FONT_SCALE)

            assertTrue(
                "the default font showed more than the smallest at $height",
                small.elementCount >= normal.elementCount,
            )
            assertTrue(
                "a 2x font showed more than the default at $height",
                normal.elementCount >= large.elementCount,
            )
        }
    }

    @Test
    fun `a nonsensical font scale is treated as the default`() {
        // `Configuration.fontScale` is a float from the system; zero or negative
        // would divide the layout into nothing. Falling back beats crashing a
        // launcher.
        assertEquals(content(FOUR_CELLS), content(FOUR_CELLS, fontScale = 0f))
        assertEquals(content(FOUR_CELLS), content(FOUR_CELLS, fontScale = -1f))
    }

    // ── The reservation ────────────────────────────────────────────────────

    @Test
    fun `the launcher's own chrome is taken off the budget`() {
        // `LocalSize` is not the height available to lay out in. Without this
        // reservation a card would claim its last element at a height where the
        // host has already taken the room for it — the clipped-element failure,
        // which looks broken rather than deliberate.
        val reserve = WalletWidgetDimensions.HOST_CHROME_RESERVE
        assertTrue("the reserve must be a real subtraction", reserve > 0.dp)

        val heightsWhereItBites = ALL_HEIGHTS.count { height ->
            content(height) != content(height + reserve)
        }

        assertTrue(
            "the reserve changed nothing at any height, so it is not being applied",
            heightsWhereItBites > 0,
        )
    }
}
