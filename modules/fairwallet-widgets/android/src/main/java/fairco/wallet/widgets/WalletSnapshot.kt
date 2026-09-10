package fairco.wallet.widgets

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.math.BigInteger

/**
 * What the widgets draw, and the only thing they read.
 *
 * The APP writes this; nothing here fetches. That is the whole architecture of
 * this module, and it follows from two facts about the wallet rather than from
 * a preference:
 *
 *  - the balance is produced by the SPV state machine in `src/wallet`, so
 *    recomputing it here would put a second definition of "how much money you
 *    have" in the codebase, and the two drifting shows up as a wrong number on
 *    a home screen;
 *  - a widget process cannot read expo-secure-store, where the active wallet
 *    and the Pocket live, so a JS→widget write path has to exist regardless of
 *    where the balance comes from.
 *
 * That also means this module has NO WorkManager job of any kind, which is worth
 * stating because its absence looks like an omission. There is nothing for a
 * background tick to fetch that would be honest to draw: the balance only
 * advances during a foreground sync (`src/services/background-sync.ts` is a
 * documented stub that returns `Success` and does nothing), and refreshing the
 * QUOTE alone would produce a fiat figure that looks current beside a balance
 * that is days old. The card carries an ABSOLUTE stamp rather than a relative
 * one for the same reason — "as of 14:32" stays true with no clock to tick it,
 * where "2 hours ago" would need waking the device to stay honest.
 *
 * A [DataStore] rather than SharedPreferences, for the [Flow]: a Glance session
 * that is already running does not re-enter `provideGlance`, so a widget
 * reading a non-reactive source would sit on whatever it read when its session
 * started and never show the balance that has just landed.
 *
 * App-scoped rather than per widget instance: every placed widget shows the
 * same wallet, so one store means one write per sync, and a widget placed while
 * the app is running paints real content on its first frame.
 */
private val Context.walletWidgetDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "fairwallet_widget_snapshot",
)

/**
 * The balance as the app last published it.
 *
 * Amounts are [BigInteger] rather than `Long` because they cross the bridge as
 * decimal strings, and a string that is not a number at all has to land
 * somewhere: [WalletSnapshotRepository] parses defensively and treats an
 * unreadable amount as absent rather than as zero. Zero is a balance someone
 * could actually have, and showing it for a value we failed to read would be
 * the most alarming possible way to be wrong.
 */
internal data class WalletSnapshot(
    val balanceSats: BigInteger?,
    val pendingSats: BigInteger,
    val pocketName: String,
    /** FAIR in USD, or `null` when there is no usable quote. */
    val priceUsd: Double?,
    /** When the balance was true, as `System.currentTimeMillis`; `0` if never. */
    val observedAtMs: Long,
) {
    /**
     * Whether there is anything to draw.
     *
     * Both conditions matter. A missing balance is the first-run case, and a
     * missing stamp means the app has never told us when the balance was true —
     * which is not a card worth drawing, since the stamp is the only thing
     * distinguishing a live balance from a stale one.
     *
     * A plain consequence of the app being the writer, stated because it is easy
     * to mistake for something it is not: the store is empty until the app has
     * run and hydrated its wallet, so a widget placed before that shows the
     * first-run card. That is what an empty store looks like — not a privacy
     * measure, and nothing here withholds the balance once it has been written.
     */
    val hasBalance: Boolean get() = balanceSats != null && observedAtMs > 0L
}

internal object WalletSnapshotRepository {
    private val KEY_BALANCE = stringPreferencesKey("balanceSats")
    private val KEY_PENDING = stringPreferencesKey("pendingSats")
    private val KEY_POCKET = stringPreferencesKey("pocketName")
    private val KEY_PRICE = doublePreferencesKey("priceUsd")
    private val KEY_OBSERVED_AT = longPreferencesKey("observedAtMs")

    /** Emits on every write, which is what re-renders a live widget. */
    fun snapshot(context: Context): Flow<WalletSnapshot> =
        context.applicationContext.walletWidgetDataStore.data.map { preferences ->
            WalletSnapshot(
                balanceSats = parseAmount(preferences[KEY_BALANCE]),
                // An unreadable pending amount is treated as none: the pending
                // line is additive information, and omitting it is safe where
                // omitting the balance is not.
                pendingSats = parseAmount(preferences[KEY_PENDING]) ?: BigInteger.ZERO,
                pocketName = preferences[KEY_POCKET].orEmpty(),
                priceUsd = usableQuote(preferences[KEY_PRICE]),
                observedAtMs = preferences[KEY_OBSERVED_AT] ?: 0L,
            )
        }

    /** The snapshot as it stands right now. */
    suspend fun read(context: Context): WalletSnapshot = snapshot(context).first()

    /** Store what the app has published. */
    suspend fun save(
        context: Context,
        balanceSats: String,
        pendingSats: String,
        pocketName: String,
        priceUsd: Double,
        observedAtMs: Long,
    ) {
        context.applicationContext.walletWidgetDataStore.edit { preferences ->
            preferences[KEY_BALANCE] = balanceSats
            preferences[KEY_PENDING] = pendingSats
            preferences[KEY_POCKET] = pocketName
            preferences[KEY_PRICE] = priceUsd
            preferences[KEY_OBSERVED_AT] = observedAtMs
        }
    }

    /**
     * Empty the store.
     *
     * Every key is removed rather than overwritten with a zero balance, so the
     * widgets fall back to their first-run state. A card reading "0.00 FAIR" for
     * a wallet that was deleted claims something false about an account that no
     * longer exists here.
     */
    suspend fun clear(context: Context) {
        context.applicationContext.walletWidgetDataStore.edit { preferences ->
            preferences.clear()
        }
    }
}

/**
 * A stored amount as a number, or `null` when it is not one.
 *
 * Amounts arrive as decimal strings because the wallet holds satoshis as
 * `bigint` and a JS number loses precision above 2^53 — the same reason the
 * `utxos` table stores `value` as TEXT.
 *
 * A NEGATIVE amount is rejected along with an unparseable one. There is no such
 * thing as a negative balance in a UTXO wallet, so its arrival means the value
 * did not come from where we think it did, and a minus sign in front of
 * someone's savings is not a good way to find that out.
 */
internal fun parseAmount(raw: String?): BigInteger? {
    if (raw.isNullOrBlank()) return null
    val parsed = runCatching { BigInteger(raw.trim()) }.getOrNull() ?: return null
    return if (parsed.signum() < 0) null else parsed
}

/**
 * A stored quote, or `null` when it cannot be used.
 *
 * Zero and negative are rejected as well as absent and non-finite: the JS side
 * documents any non-positive value as "no quote", and a fiat line reading
 * "$0.00" beside a real balance says something false rather than something
 * missing.
 */
internal fun usableQuote(raw: Double?): Double? {
    if (raw == null) return null
    if (!raw.isFinite() || raw <= 0.0) return null
    return raw
}
