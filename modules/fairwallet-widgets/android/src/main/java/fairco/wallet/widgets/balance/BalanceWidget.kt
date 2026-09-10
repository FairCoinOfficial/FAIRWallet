package fairco.wallet.widgets.balance

import android.content.Context
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.state.GlanceStateDefinition
import fairco.wallet.widgets.WalletSnapshotRepository
import fairco.wallet.widgets.theme.FairGlanceTheme
import kotlinx.coroutines.flow.first

/**
 * The balance widget.
 *
 * It draws from [WalletSnapshotRepository] and never fetches: composing happens
 * while the launcher waits for a `RemoteViews`, and there is nothing to fetch
 * anyway — the app is the only thing that can advance a balance
 * (`src/services/background-sync.ts` is a documented stub), so this module has
 * no background job at all.
 */
internal class BalanceWidget : GlanceAppWidget() {

    /**
     * EXACT rather than `Responsive`, and it is the most consequential line
     * here.
     *
     * `SizeMode.Responsive(sizes)` composes once per DECLARED size, and
     * `LocalSize` then reports the declared size that matched rather than the
     * real one — so every count derived from it is quantised to the declared
     * set. This card decides what fits by arithmetic against the actual height
     * (`balanceCardContent`), so a quantised height would drop a line on a
     * placement that had room for it, at exactly the sizes nobody declared.
     *
     * `Exact` composes for the sizes the HOST reports, so the arithmetic is
     * done against the truth. It costs a recomposition on resize, which is
     * cheap here: the content is a local DataStore read and never a network
     * call. This widget also carries no bitmaps, so the payload argument that
     * pushes an image-bearing widget towards `Responsive` does not apply.
     */
    override val sizeMode: SizeMode = SizeMode.Exact

    /**
     * No per-widget state. Every placed balance widget shows the same wallet
     * from one app-scoped store, so the default
     * `PreferencesGlanceStateDefinition` would only create an empty preferences
     * file per widget id.
     */
    override val stateDefinition: GlanceStateDefinition<*>? = null

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // Built once, outside the composition: `snapshot` returns a fresh Flow
        // per call, and collecting a new instance on every recomposition would
        // resubscribe to DataStore each time.
        val snapshots = WalletSnapshotRepository.snapshot(context)
        val initial = snapshots.first()

        provideContent {
            val current by snapshots.collectAsState(initial = initial)
            FairGlanceTheme {
                BalanceWidgetContent(current)
            }
        }
    }
}

/**
 * The balance widget's manifest entry point.
 *
 * Deliberately bare. There is no schedule to start in `onEnabled` and none to
 * cancel in `onDisabled`, because this module enqueues no work of any kind —
 * the store's `Flow` re-renders a live widget whenever the app writes, and
 * `onUpdate` covers a reboot or an app update by re-composing from what is
 * already on disk. A widget that costs nothing while nobody is looking at it
 * cannot leak a job.
 */
class BalanceWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BalanceWidget()
}
