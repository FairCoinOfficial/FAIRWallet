package fairco.wallet.widgets.balance

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.Text
import androidx.glance.unit.ColorProvider
import android.content.Context
import android.content.Intent
import fairco.wallet.widgets.BalanceCardContent
import fairco.wallet.widgets.R
import fairco.wallet.widgets.StampForm
import fairco.wallet.widgets.WalletSnapshot
import fairco.wallet.widgets.WalletWidgetDimensions
import fairco.wallet.widgets.WalletWidgetTextStyles
import fairco.wallet.widgets.WidgetLinks
import fairco.wallet.widgets.balanceCardContent
import fairco.wallet.widgets.fiatValue
import fairco.wallet.widgets.formatFairAmount
import fairco.wallet.widgets.formatFiat
import fairco.wallet.widgets.stampForm
import java.math.BigInteger
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * The balance card.
 *
 * Top to bottom: the POCKET this money belongs to, the BALANCE as the
 * emphasised element, anything PENDING, what it is worth, the "as of" STAMP,
 * and a pair of shortcuts. Which of those appear at a given size is decided by
 * `balanceCardContent`, not here — this file draws what it is told to.
 *
 * THE ORDER IS AN ARGUMENT. The stamp sits directly under the money rather than
 * at the foot of the card, because it qualifies every line above it and because
 * an always-visible balance with no date on it reads as live however old it is.
 * This wallet's background sync is a documented stub
 * (`src/services/background-sync.ts`), so the number can be days old with
 * nothing else on screen to say so.
 *
 * A plain [Box] with a `background` modifier rather than Glance's `Scaffold`:
 * `Scaffold` applies a vertical padding it does not expose, and every height
 * decision in `WalletWidgetStyle.kt` is arithmetic against the space actually
 * available. The launcher rounds widget corners itself on API 31+, so nothing
 * is lost by not having it.
 */
@Composable
internal fun BalanceWidgetContent(snapshot: WalletSnapshot) {
    val context = LocalContext.current
    val height = LocalSize.current.height
    val configuration = context.resources.configuration

    val content = balanceCardContent(
        height = height,
        hasPending = snapshot.pendingSats.signum() > 0,
        // The reader's font setting. Left out, a card at a large scale would
        // claim room for a line it cannot draw and clip it instead of dropping
        // it.
        fontScale = configuration.fontScale,
    )

    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(GlanceTheme.colors.widgetBackground)
            .padding(content.padding),
    ) {
        if (!snapshot.hasBalance) {
            BalanceEmptyContent()
        } else {
            BalanceCard(snapshot = snapshot, content = content)
        }
    }
}

@Composable
private fun BalanceCard(
    snapshot: WalletSnapshot,
    content: BalanceCardContent,
) {
    val context = LocalContext.current
    val onSurface = GlanceTheme.colors.onSurface
    val muted = GlanceTheme.colors.onSurfaceVariant
    val locale = primaryLocale(context)

    // Never null on this branch — `hasBalance` is exactly the guard for it —
    // but read through a local so the layout below has no nullable arithmetic
    // in it.
    val balance = snapshot.balanceSats ?: BigInteger.ZERO
    val balanceText = formatFairAmount(balance, locale)

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            // The whole card opens the wallet. That is what makes the action
            // buttons optional at small sizes: losing them costs a tap, not a
            // destination.
            .semantics {
                contentDescription = cardDescription(context, snapshot, balanceText, locale)
            }
            .clickable(actionStartActivity(WidgetLinks.home(context))),
    ) {
        if (content.showsPocket && snapshot.pocketName.isNotBlank()) {
            Text(
                text = snapshot.pocketName,
                style = WalletWidgetTextStyles.pocket(muted),
                maxLines = 1,
                // The card's own description already reads everything out; a
                // per-line description would repeat it.
                modifier = GlanceModifier.semantics { contentDescription = "" },
            )
            Spacer(GlanceModifier.height(WalletWidgetDimensions.LINE_SPACING))
        }

        Text(
            text = context.getString(
                R.string.fairwallet_widget_balance_amount,
                balanceText,
            ),
            style = WalletWidgetTextStyles.balance(onSurface, content.balanceFontSize),
            maxLines = 1,
            modifier = GlanceModifier.semantics { contentDescription = "" },
        )

        if (content.showsPending) {
            Spacer(GlanceModifier.height(WalletWidgetDimensions.LINE_SPACING))
            Text(
                text = context.getString(
                    R.string.fairwallet_widget_balance_pending,
                    formatFairAmount(snapshot.pendingSats, locale),
                ),
                style = WalletWidgetTextStyles.pending(GlanceTheme.colors.primary),
                maxLines = 1,
                modifier = GlanceModifier.semantics { contentDescription = "" },
            )
        }

        if (content.showsFiat) {
            // Absent whenever there is no usable quote, which is a different
            // thing from a value of zero and is drawn as nothing rather than as
            // "$0.00".
            val fiat = fiatValue(balance, snapshot.priceUsd)
            if (fiat != null) {
                Spacer(GlanceModifier.height(WalletWidgetDimensions.LINE_SPACING))
                Text(
                    text = context.getString(
                        R.string.fairwallet_widget_balance_fiat,
                        formatFiat(fiat, locale),
                    ),
                    style = WalletWidgetTextStyles.fiat(muted),
                    maxLines = 1,
                    modifier = GlanceModifier.semantics { contentDescription = "" },
                )
            }
        }

        Spacer(GlanceModifier.height(WalletWidgetDimensions.LINE_SPACING))
        Text(
            text = stampText(context, snapshot.observedAtMs, locale),
            style = WalletWidgetTextStyles.stamp(muted),
            maxLines = 1,
            modifier = GlanceModifier.semantics { contentDescription = "" },
        )

        if (content.showsActions) {
            // The card's one flexible element: it pushes the shortcuts to the
            // bottom edge on a placement with slack, so the money block stays
            // where the eye lands rather than floating in the middle.
            Spacer(GlanceModifier.defaultWeight())
            BalanceActionsRow()
        }
    }
}

/**
 * The two shortcuts.
 *
 * Receive first: it is the one that cannot lose anyone money, and the one a
 * reader is more likely to want from a home screen.
 */
@Composable
private fun BalanceActionsRow() {
    val context = LocalContext.current
    Row(modifier = GlanceModifier.fillMaxWidth()) {
        WidgetActionButton(
            label = context.getString(R.string.fairwallet_widget_action_receive),
            intentProvider = { WidgetLinks.receive(context) },
            modifier = GlanceModifier.defaultWeight(),
        )
        Spacer(GlanceModifier.width(WalletWidgetDimensions.ACTION_SPACING))
        WidgetActionButton(
            label = context.getString(R.string.fairwallet_widget_action_send),
            intentProvider = { WidgetLinks.send(context) },
            modifier = GlanceModifier.defaultWeight(),
        )
    }
}

/**
 * One shortcut.
 *
 * A `Box` with a background rather than Glance's `Button`, because the height
 * has to be exactly [WalletWidgetDimensions.ACTION_SIZE] — that number is what
 * the card's height budget was computed against, and a button free to size
 * itself would be the one element that could overrun the arithmetic.
 */
@Composable
internal fun WidgetActionButton(
    label: String,
    intentProvider: () -> Intent,
    modifier: GlanceModifier = GlanceModifier,
) {
    Box(
        modifier = modifier
            .height(WalletWidgetDimensions.ACTION_SIZE)
            .background(GlanceTheme.colors.secondaryContainer)
            .cornerRadius(ACTION_CORNER_RADIUS)
            .clickable(actionStartActivity(intentProvider())),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = WalletWidgetTextStyles.action(GlanceTheme.colors.onSecondaryContainer),
            maxLines = 1,
        )
    }
}

/** Material 3 Expressive's full-round shape for a pill-shaped control. */
private val ACTION_CORNER_RADIUS = 24.dp

/**
 * What a placed widget shows before the app has ever published a balance.
 *
 * Never a zero balance: "0.00 FAIR" for a wallet nobody has opened yet claims
 * something specific and false. The widget says it has nothing to show and
 * offers the one thing that fixes it.
 */
@Composable
private fun BalanceEmptyContent() {
    val context = LocalContext.current
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity(WidgetLinks.home(context))),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = context.getString(R.string.fairwallet_widget_balance_empty),
            style = WalletWidgetTextStyles.empty(GlanceTheme.colors.onSurface),
            maxLines = 2,
        )
    }
}

/**
 * The "as of" line.
 *
 * A short time for a balance observed today, and a date as well for anything
 * else — see `stampForm`, which owns that decision and is unit tested. The
 * formats come from [DateFormat] rather than a pattern string so they follow
 * the reader's locale and their 12/24-hour setting.
 */
private fun stampText(
    context: Context,
    observedAtMs: Long,
    locale: Locale,
): String {
    val zone = TimeZone.getDefault()
    val moment = Date(observedAtMs)
    val time = DateFormat.getTimeInstance(DateFormat.SHORT, locale).apply {
        timeZone = zone
    }.format(moment)

    return when (stampForm(observedAtMs, System.currentTimeMillis(), zone.toZoneId())) {
        StampForm.TIME_ONLY ->
            context.getString(R.string.fairwallet_widget_balance_stamp_time, time)

        StampForm.DATE_AND_TIME -> {
            val date = DateFormat.getDateInstance(DateFormat.MEDIUM, locale).apply {
                timeZone = zone
            }.format(moment)
            context.getString(R.string.fairwallet_widget_balance_stamp_date, date, time)
        }
    }
}

/**
 * The whole card as one sentence, for TalkBack.
 *
 * Read out as a unit because the card is a single tap target: a screen reader
 * moving line by line through a balance, a pending amount and a timestamp would
 * make the reader assemble the sentence themselves.
 */
private fun cardDescription(
    context: Context,
    snapshot: WalletSnapshot,
    balanceText: String,
    locale: Locale,
): String {
    val parts = mutableListOf(
        context.getString(R.string.fairwallet_widget_balance_amount, balanceText),
    )
    if (snapshot.pendingSats.signum() > 0) {
        parts += context.getString(
            R.string.fairwallet_widget_balance_pending,
            formatFairAmount(snapshot.pendingSats, locale),
        )
    }
    parts += stampText(context, snapshot.observedAtMs, locale)
    return parts.joinToString(separator = ", ")
}

/**
 * The reader's primary locale.
 *
 * Taken from the configuration rather than `Locale.getDefault()` so a widget
 * follows the per-app or per-system language the user actually set.
 */
private fun primaryLocale(context: Context): Locale =
    context.resources.configuration.locales.get(0) ?: Locale.getDefault()
