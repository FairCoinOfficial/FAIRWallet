package fairco.wallet.widgets

import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Where a tap on a widget takes the reader.
 *
 * Every target is an expo-router ROUTE URL on the app's own `fairwallet` scheme
 * (`app.json` declares `fairwallet` and `faircoin`), and every intent is pinned
 * to this package with `setPackage`. Pinning matters more here than on most
 * surfaces: an unpinned `ACTION_VIEW` for a wallet's scheme is a chooser that
 * another installed app can appear in, and "open my wallet" is not a choice
 * worth offering.
 *
 * These are ROUTE urls rather than `faircoin:` BIP21 URIs, and the difference is
 * worth knowing. `useDeepLinkHandler` in `app/_layout.tsx` intercepts only
 * `faircoin:` payment URIs — it parses them and pushes `/send` with the address
 * and amount prefilled, queueing them while the app is locked. A route URL like
 * `fairwallet:///receive` falls through to expo-router's own linking instead.
 *
 * That fall-through is the behaviour we want. The widget has no address or
 * amount to prefill, so there is nothing for the BIP21 parser to do, and
 * expo-router navigates underneath the `LockGate` overlay: a locked wallet shows
 * its PIN screen, and the reader lands on the screen they tapped once they
 * unlock. The one thing it does NOT inherit is the queue's five-minute
 * freshness window — which is the right trade, since a reader who unlocks two
 * minutes later still meant to open Receive.
 */
internal object WidgetLinks {

    /** The app's own scheme, as declared in `app.json`. */
    private const val SCHEME = "fairwallet"

    /**
     * The wallet itself. The whole balance card carries this, so every part of
     * it that is not a button is still a tap target.
     */
    fun home(context: Context): Intent = viewIntent(context, "$SCHEME:///")

    /** The receive screen, with its address and QR code. */
    fun receive(context: Context): Intent = viewIntent(context, "$SCHEME:///receive")

    /**
     * The send screen.
     *
     * No address or amount: a widget has nobody to pay. Prefilling is what the
     * `faircoin:` BIP21 path is for, and it is reached by scanning a code or
     * following a payment link, not from a home screen.
     */
    fun send(context: Context): Intent = viewIntent(context, "$SCHEME:///send")

    private fun viewIntent(context: Context, url: String): Intent =
        Intent(Intent.ACTION_VIEW, Uri.parse(url))
            .setPackage(context.packageName)
            // A widget tap starts from the launcher, which is not an activity
            // context of ours, so the task has to be a new one.
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
