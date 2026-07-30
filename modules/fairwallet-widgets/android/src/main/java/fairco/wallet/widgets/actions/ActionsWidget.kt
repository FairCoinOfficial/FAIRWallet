package fairco.wallet.widgets.actions

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import fairco.wallet.widgets.R
import fairco.wallet.widgets.WalletWidgetDimensions
import fairco.wallet.widgets.WidgetLinks
import fairco.wallet.widgets.balance.WidgetActionButton
import fairco.wallet.widgets.theme.FairGlanceTheme

/**
 * The actions widget: Receive and Send, and NO BALANCE in any state.
 *
 * It exists so that wanting the shortcuts and wanting a figure on the home
 * screen are separate choices: someone who wants the shortcut without the
 * number never has to place the other one.
 *
 * It also costs nothing to run — no store, no worker, no state — so placing it
 * is free in a way the balance widget cannot be.
 */
internal class ActionsWidget : GlanceAppWidget() {

    /**
     * EXACT, matching the balance widget. Nothing here is derived from the
     * height, but a widget that composes for its real size rather than the
     * nearest declared one is simply the better default, and having both
     * widgets behave the same way removes a difference nobody would remember.
     */
    override val sizeMode: SizeMode = SizeMode.Exact

    /** Nothing to persist. This widget has no state of any kind. */
    override val stateDefinition: GlanceStateDefinition<*>? = null

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            FairGlanceTheme {
                ActionsWidgetContent()
            }
        }
    }
}

@Composable
private fun ActionsWidgetContent() {
    val context = LocalContext.current
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(GlanceTheme.colors.widgetBackground)
            .padding(WalletWidgetDimensions.PADDING_COMPACT),
        contentAlignment = Alignment.Center,
    ) {
        Row {
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
}

/**
 * The actions widget's manifest entry point.
 *
 * Bare for the same reason as the balance widget's, and more so: this one reads
 * nothing and schedules nothing, so there is no lifecycle to manage at all.
 */
class ActionsWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ActionsWidget()
}
