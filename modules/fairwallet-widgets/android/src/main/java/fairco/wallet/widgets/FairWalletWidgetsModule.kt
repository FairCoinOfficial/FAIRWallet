package fairco.wallet.widgets

import android.content.Context
import androidx.glance.appwidget.updateAll
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import fairco.wallet.widgets.actions.ActionsWidget
import fairco.wallet.widgets.balance.BalanceWidget

/**
 * JS side of FAIRWallet's home-screen widgets.
 *
 * Deliberately small, and it stays that way. The widgets own their rendering
 * end to end in Kotlin; what crosses this bridge is the DATA the app alone can
 * produce — the balance comes out of the SPV state machine in `src/wallet`, and
 * the Pocket it belongs to is behind expo-secure-store, which a widget process
 * cannot read.
 *
 * Every parameter is a PLAIN SCALAR. An Expo Modules `Record` is deliberately
 * not used here: it fails to convert in some consumer build configurations
 * ("cannot be cast to type … (received ReadableNativeMap)"), and a bridge that
 * works in every configuration is worth more than a tidy signature.
 */
class FairWalletWidgetsModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("FairWalletWidgets")

        /**
         * Publish what the widgets should draw.
         *
         * Amounts arrive as decimal strings because the wallet holds satoshis
         * as `bigint` and a JS number loses precision above 2^53 — the same
         * reason the `utxos` table stores `value` as TEXT. They are stored
         * verbatim and parsed on read, so a value this build cannot read fails
         * as an absent balance rather than as a wrong one.
         *
         * `observedAtMs` is when the balance was TRUE, not when this was
         * called. The card stamps it, and the fiat figure inherits it.
         */
        AsyncFunction("setSnapshot") Coroutine { balanceSats: String,
                                                 pendingSats: String,
                                                 pocketName: String,
                                                 priceUsd: Double,
                                                 observedAtMs: Long ->
            val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
            WalletSnapshotRepository.save(
                context = context,
                balanceSats = balanceSats,
                pendingSats = pendingSats,
                pocketName = pocketName,
                priceUsd = priceUsd,
                observedAtMs = observedAtMs,
            )
            redrawAll(context)
        }

        /**
         * Forget the snapshot.
         *
         * Called when the wallet it described is gone — deleted, or the app
         * reset. A widget left holding the last balance of a wallet that no
         * longer exists on this device is both wrong and a disclosure.
         */
        AsyncFunction("clearSnapshot") Coroutine { ->
            val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
            WalletSnapshotRepository.clear(context)
            redrawAll(context)
        }
    }
}

/**
 * Redraw every placed widget.
 *
 * The store's `Flow` already re-renders any widget with a LIVE Glance session;
 * this covers the rest — a widget whose session has been torn down, which is
 * most of them most of the time. `updateAll` on a widget with no instances is a
 * no-op, so no placement check is needed first.
 *
 * The actions widget is included even though it reads no snapshot: it costs
 * nothing when none is placed, and leaving it out would be a difference that
 * only matters the day someone gives it something to draw.
 */
private suspend fun redrawAll(context: Context) {
    BalanceWidget().updateAll(context)
    ActionsWidget().updateAll(context)
}
