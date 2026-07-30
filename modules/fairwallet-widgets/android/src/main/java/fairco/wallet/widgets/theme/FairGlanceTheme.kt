package fairco.wallet.widgets.theme

import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.glance.GlanceComposable
import androidx.glance.GlanceTheme
// Two different `ColorProvider`s, and both are needed: `androidx.glance.unit` is
// the TYPE, `androidx.glance.color` is the day/night factory that builds one.
// Same split as androidx.glance:glance-material3's own theme file.
import androidx.glance.color.ColorProvider
import androidx.glance.color.ColorProviders
import androidx.glance.color.colorProviders

/**
 * The theme every FAIRWallet widget is drawn in.
 *
 * Material You first: on Android 12+ the widget takes its colours from the
 * user's wallpaper, which is what a bare [GlanceTheme] already does — its
 * default `colors` resolves to the `@android:color/system_*` palette on API
 * 31+ — so the dynamic branch passes no colours rather than reimplementing the
 * lookup.
 *
 * Below API 31 there is no wallpaper palette, and Glance's own fallback is the
 * Material BASELINE scheme, which is purple. A FAIRWallet widget sitting next
 * to the FAIRWallet icon should not be purple, so the fallback is the app's own
 * palette below.
 */
@Composable
fun FairGlanceTheme(content: @GlanceComposable @Composable () -> Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        GlanceTheme(content = content)
    } else {
        GlanceTheme(colors = FairWidgetColors, content = content)
    }
}

/**
 * FAIRWallet's palette as a Material 3 role set, for devices with no dynamic
 * colour.
 *
 * GENERATED, not authored. Every value is Bloom's colour engine resolving the
 * `faircoin` preset — seed `#9ffb50`, variant `vivid`, the preset the app mounts
 * in `app/_layout.tsx` — into the full Material 3 role set for light and dark:
 *
 *     const { generateRoleColors } =
 *       require('@oxyhq/bloom/lib/commonjs/theme/color-engine')
 *     const { APP_COLOR_PRESETS } =
 *       require('@oxyhq/bloom/lib/commonjs/theme/color-presets')
 *     const p = APP_COLOR_PRESETS.faircoin
 *     generateRoleColors({ seed: p.hex, variant: p.variant, isDark: false })
 *
 * `widgetBackground` is the one role Bloom has no equivalent for — it is
 * widget-only — so it is derived the way `glance-material3` derives it: take
 * `secondaryContainer` into HCT and shift its tone by +5 when the tone is above
 * 50, by −10 otherwise (`adjustColorToneForWidgetBackground` in
 * androidx.glance:glance-material3).
 *
 * Note the seed is `#9ffb50`, one digit from the `FAIRCOIN_GREEN = "#9ffb4f"`
 * constant in `src/ui/components/FairCoinSymbol.tsx`. Bloom's preset is the
 * source here because it is what actually themes the running app; the constant
 * is used for one-off tints. Regenerate rather than hand-edit if either moves.
 */
internal val FairWidgetColors: ColorProviders = colorProviders(
    primary = ColorProvider(day = Color(0xFF376B00), night = Color(0xFF78DF00)),
    onPrimary = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF1A3700)),
    primaryContainer = ColorProvider(day = Color(0xFF8AFE00), night = Color(0xFF285000)),
    onPrimaryContainer = ColorProvider(day = Color(0xFF285000), night = Color(0xFF8AFE00)),
    secondary = ColorProvider(day = Color(0xFF006E2B), night = Color(0xFF66DE7C)),
    onSecondary = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF003913)),
    secondaryContainer = ColorProvider(day = Color(0xFF82FC95), night = Color(0xFF00531E)),
    onSecondaryContainer = ColorProvider(day = Color(0xFF00531E), night = Color(0xFF82FC95)),
    tertiary = ColorProvider(day = Color(0xFF006C49), night = Color(0xFF00E29D)),
    onTertiary = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF003824)),
    tertiaryContainer = ColorProvider(day = Color(0xFF47FFB8), night = Color(0xFF005236)),
    onTertiaryContainer = ColorProvider(day = Color(0xFF005236), night = Color(0xFF47FFB8)),
    error = ColorProvider(day = Color(0xFFBA1A1A), night = Color(0xFFFFB4AB)),
    errorContainer = ColorProvider(day = Color(0xFFFFDAD6), night = Color(0xFF93000A)),
    onError = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF690005)),
    onErrorContainer = ColorProvider(day = Color(0xFF93000A), night = Color(0xFFFFDAD6)),
    background = ColorProvider(day = Color(0xFFF6FCE9), night = Color(0xFF10150A)),
    onBackground = ColorProvider(day = Color(0xFF181D12), night = Color(0xFFDFE5D3)),
    surface = ColorProvider(day = Color(0xFFF6FCE9), night = Color(0xFF10150A)),
    onSurface = ColorProvider(day = Color(0xFF181D12), night = Color(0xFFDFE5D3)),
    surfaceVariant = ColorProvider(day = Color(0xFFDDE6CF), night = Color(0xFF414939)),
    onSurfaceVariant = ColorProvider(day = Color(0xFF414939), night = Color(0xFFC1CAB4)),
    outline = ColorProvider(day = Color(0xFF727A67), night = Color(0xFF8B9480)),
    inverseOnSurface = ColorProvider(day = Color(0xFFEDF3E1), night = Color(0xFF2C3226)),
    inverseSurface = ColorProvider(day = Color(0xFF2C3226), night = Color(0xFFDFE5D3)),
    inversePrimary = ColorProvider(day = Color(0xFF78DF00), night = Color(0xFF376B00)),
    widgetBackground = ColorProvider(day = Color(0xFFC7FFC8), night = Color(0xFF003912)),
)
