/**
 * Places that accept FairCoin — native map screen (iOS + Android).
 *
 * Layout (Revolut / Google Maps inspired):
 *
 *  - Full-bleed map filling the viewport behind everything.
 *  - Floating pill search bar at the top-safe-area with a back button + text
 *    input. `bg-background` with `rounded-full` and a soft shadow.
 *  - Circular "my location" FAB bottom-right above the bottom sheet. Permission
 *    is requested lazily on first tap.
 *  - Bottom sheet card docked at the bottom with a drag handle, section title,
 *    and a horizontally-scrolling list of place cards. Tapping a card animates
 *    the camera and highlights the selection; tapping a marker does the same.
 *
 * Map implementation:
 *  - Uses `@maplibre/maplibre-react-native` (MapLibre Native v10) on both iOS
 *    and Android — a single open-source SDK forked from Mapbox GL that
 *    delivers a consistent look across platforms with no access token, no
 *    usage limits, and no proprietary vendor lock-in.
 *  - Web / Electron is routed to `map.web.tsx` via Metro's platform-specific
 *    file resolution. `@maplibre/maplibre-react-native` does not support web.
 *  - Tiles come from Carto (https://carto.com/basemaps) — free, public
 *    vector-tile provider that hosts the MapLibre `liberty` and `dark-matter`
 *    styles with no API key and no rate limits. The `liberty` style includes
 *    a `building-3d` extrusion layer that renders 3D buildings at high zoom.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import {
  MapView,
  Camera,
  MarkerView,
  UserLocation,
  setAccessToken,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { useTheme } from "@oxyhq/bloom/theme";
import { t } from "../src/i18n";
import { PLACES, distanceKm, type Place, type PlaceCategory } from "../src/data/places";

// ---------------------------------------------------------------------------
// MapLibre access token
// ---------------------------------------------------------------------------

/**
 * MapLibre is open-source and requires no access token, but the native module
 * still expects `setAccessToken` to be called once at module load so its
 * internal state machine transitions out of the "unset" state. Passing `null`
 * is the documented way to opt out of token-based auth entirely. The native
 * side resolves the returned promise synchronously — we intentionally do not
 * await it; any error would come from a misconfigured bridge, not from our
 * (absent) token.
 */
void setAccessToken(null);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * MapLibre (like Mapbox / GeoJSON) uses `[longitude, latitude]` positions
 * throughout its API — we alias the tuple locally for readability.
 */
type Position = [number, number];

interface UserCoords {
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * MapLibre-compatible vector tile style URLs. We use Carto's free basemap
 * styles (https://github.com/CartoDB/basemap-styles) — no API key, no rate
 * limits, no billing. `voyager` is a full-colour streets basemap for light
 * mode, `dark-matter` is the dark-mode equivalent.
 */
const MAP_STYLE_LIGHT =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const MAP_STYLE_DARK =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Zoom level used whenever we animate the camera to a single place. */
const PLACE_ZOOM = 16;
/** Zoom level used when centering on the user's current location. */
const USER_ZOOM = 15;
/** Zoom level used for the initial overview camera. */
const INITIAL_ZOOM = 5;
/**
 * Pitch (in degrees) used for the initial overview camera. A gentle tilt
 * surfaces the 3D building extrusions from OpenFreeMap's `liberty` style
 * without disorienting users who zoom out to see the whole map.
 */
const INITIAL_PITCH = 30;
/**
 * Pitch used when we animate to a specific place. A steeper angle gives the
 * "immersive" Revolut-style feel when zoomed into buildings.
 */
const PLACE_PITCH = 45;
/** Camera animation duration in milliseconds. */
const CAMERA_ANIMATION_MS = 500;
/** Width of the horizontally-scrolling place card. */
const CARD_WIDTH = 280;
/** Snap points for the docked bottom sheet (40% peek, 80% expanded). */
const SHEET_SNAP_POINTS: Array<string | number> = ["40%", "80%"];
/** Fallback map center when PLACES is empty (roughly Madrid). */
const FALLBACK_CENTER: Position = [-3.7038, 40.4168];

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORY_ICON: Record<PlaceCategory, IconName> = {
  cafe: "coffee",
  restaurant: "silverware-fork-knife",
  shop: "storefront",
  service: "tools",
  atm: "cash-multiple",
  other: "map-marker",
};

function categoryLabel(category: PlaceCategory): string {
  return t(`map.category.${category}`);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // ---- Ref to the MapLibre camera for imperative animations ----
  const cameraRef = useRef<CameraRef>(null);

  // ---- Horizontal card list ref, for scroll-to-selected ----
  const cardScrollRef = useRef<ScrollView>(null);

  // ---- State ----
  const [query, setQuery] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(PLACES[0]?.id ?? "");
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [userLocation, setUserLocation] = useState<UserCoords | null>(null);

  // ---- Filtered places (search) ----
  const filteredPlaces = useMemo<readonly Place[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return PLACES;
    return PLACES.filter((p) => {
      return (
        p.name.toLowerCase().includes(trimmed) ||
        p.city.toLowerCase().includes(trimmed) ||
        p.country.toLowerCase().includes(trimmed) ||
        p.address.toLowerCase().includes(trimmed) ||
        categoryLabel(p.category).toLowerCase().includes(trimmed)
      );
    });
  }, [query]);

  // ---- Initial camera position: first place, overridden later by user loc ----
  const initialCenter = useMemo<Position>(() => {
    const first = PLACES[0];
    if (!first) return FALLBACK_CENTER;
    return [first.longitude, first.latitude];
  }, []);

  // ---- Camera animation ----
  const animateToCoordinates = useCallback(
    (latitude: number, longitude: number, zoomLevel: number, pitch: number) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel,
        pitch,
        animationDuration: CAMERA_ANIMATION_MS,
        animationMode: "flyTo",
      });
    },
    [],
  );

  // ---- Select a place (from card tap or marker tap) ----
  const selectPlace = useCallback(
    (place: Place, shouldAnimateCamera: boolean) => {
      setSelectedPlaceId(place.id);

      if (shouldAnimateCamera) {
        animateToCoordinates(place.latitude, place.longitude, PLACE_ZOOM, PLACE_PITCH);
      }

      // Scroll the card list to the selected card.
      const idx = filteredPlaces.findIndex((p) => p.id === place.id);
      if (idx >= 0) {
        cardScrollRef.current?.scrollTo({
          x: idx * (CARD_WIDTH + 12),
          animated: true,
        });
      }
    },
    [animateToCoordinates, filteredPlaces],
  );

  // ---- "My location" FAB: request permission, fetch, center camera ----
  const handleLocateMe = useCallback(async () => {
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;

      if (status !== "granted") {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }

      if (status !== "granted") {
        setHasLocationPermission(false);
        Alert.alert(
          t("map.permissionDenied.title"),
          t("map.permissionDenied.subtitle"),
        );
        return;
      }

      setHasLocationPermission(true);

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords: UserCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setUserLocation(coords);
      animateToCoordinates(coords.latitude, coords.longitude, USER_ZOOM, PLACE_PITCH);
    } catch {
      // We intentionally swallow the underlying error and surface a user
      // facing permission alert. The expo-location API rejects for a variety
      // of reasons (permission denied, services disabled, timeout) and the
      // message shown to the user covers all of them.
      Alert.alert(
        t("map.permissionDenied.title"),
        t("map.permissionDenied.subtitle"),
      );
    }
  }, [animateToCoordinates]);

  // ---- Distance per place, sorted by proximity if we have user location ----
  const placesWithDistance = useMemo(() => {
    return filteredPlaces.map((place) => {
      const km = userLocation
        ? distanceKm(userLocation, {
            latitude: place.latitude,
            longitude: place.longitude,
          })
        : null;
      return { place, km };
    });
  }, [filteredPlaces, userLocation]);

  // ---- MapLibre style URL: follow the active Bloom theme ----
  const mapStyleUrl = theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  // ---- Bottom sheet styling that follows the Bloom theme ----
  const sheetBackgroundStyle = useMemo(
    () => ({ backgroundColor: theme.colors.background }),
    [theme.colors.background],
  );

  const sheetHandleStyle = useMemo(
    () => ({ backgroundColor: theme.colors.textSecondary }),
    [theme.colors.textSecondary],
  );

  return (
    <View className="flex-1 bg-background">
      {/* ---- Full-bleed native map ---- */}
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyleUrl}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: INITIAL_ZOOM,
            pitch: INITIAL_PITCH,
            heading: 0,
          }}
          animationMode="flyTo"
          animationDuration={CAMERA_ANIMATION_MS}
        />
        {hasLocationPermission ? <UserLocation visible animated /> : null}
        {filteredPlaces.map((place) => (
          <MarkerView
            key={place.id}
            coordinate={[place.longitude, place.latitude]}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <Pressable
              onPress={() => selectPlace(place, true)}
              accessibilityRole="button"
              accessibilityLabel={place.name}
              hitSlop={6}
            >
              <View
                className="w-9 h-9 rounded-full items-center justify-center border-2 border-white"
                style={{ backgroundColor: theme.colors.primary }}
              >
                <MaterialCommunityIcons
                  name={CATEGORY_ICON[place.category]}
                  size={18}
                  color="#ffffff"
                />
              </View>
            </Pressable>
          </MarkerView>
        ))}
      </MapView>

      {/* ---- Top floating pill: back button + search input ---- */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + 10,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          zIndex: 10,
        }}
      >
        <View
          className="flex-row items-center bg-background rounded-full px-3 h-[52px]"
          style={styles.floatingBar}
        >
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full active:bg-surface"
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.colors.text}
            />
          </Pressable>

          <View className="flex-row items-center flex-1 ml-1">
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={theme.colors.textSecondary}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("map.searchPlaceholder")}
              placeholderTextColor={theme.colors.textSecondary}
              className="flex-1 ml-2 text-foreground text-base"
              style={{ color: theme.colors.text }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        </View>
      </View>

      {/* ---- Floating "my location" FAB ---- */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 16,
          bottom: "42%",
          zIndex: 9,
        }}
      >
        <Pressable
          onPress={handleLocateMe}
          className="w-12 h-12 rounded-full bg-background items-center justify-center active:opacity-80"
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel={t("map.locateMe.accessibility")}
        >
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={22}
            color={theme.colors.primary}
          />
        </Pressable>
      </View>

      {/* ---- Bottom sheet with place list ---- */}
      <BottomSheet
        snapPoints={SHEET_SNAP_POINTS}
        index={0}
        enablePanDownToClose={false}
        backgroundStyle={sheetBackgroundStyle}
        handleIndicatorStyle={sheetHandleStyle}
      >
        <BottomSheetView className="flex-1 pt-1">
          <View className="px-5 pb-2 flex-row items-center justify-between">
            <Text className="text-foreground text-lg font-semibold">
              {t("map.nearYou")}
            </Text>
            <Text className="text-muted-foreground text-xs">
              {filteredPlaces.length}
            </Text>
          </View>

          {placesWithDistance.length === 0 ? (
            <View className="items-center justify-center py-10 px-6">
              <View className="w-14 h-14 rounded-full bg-surface items-center justify-center mb-3">
                <MaterialCommunityIcons
                  name="map-marker-off"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </View>
              <Text className="text-foreground text-base font-medium">
                {t("map.noResults")}
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={cardScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardListContent}
              snapToInterval={CARD_WIDTH + 12}
              decelerationRate="fast"
            >
              {placesWithDistance.map(({ place, km }) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  distanceKm={km}
                  isSelected={place.id === selectedPlaceId}
                  onPress={() => selectPlace(place, true)}
                />
              ))}
            </ScrollView>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PlaceCard — horizontal card for the bottom sheet list
// ---------------------------------------------------------------------------

interface PlaceCardProps {
  place: Place;
  distanceKm: number | null;
  isSelected: boolean;
  onPress: () => void;
}

function PlaceCard({ place, distanceKm: km, isSelected, onPress }: PlaceCardProps) {
  const theme = useTheme();
  const icon = CATEGORY_ICON[place.category];

  const borderClass = isSelected ? "border-2 border-primary" : "border border-border";

  const subtitle = km !== null
    ? t("map.distance", { km: km < 10 ? km.toFixed(1) : Math.round(km) })
    : `${place.city}, ${place.country}`;

  return (
    <Pressable
      onPress={onPress}
      className={`bg-surface rounded-2xl p-4 mr-3 flex-row items-center active:opacity-80 ${borderClass}`}
      style={{ width: CARD_WIDTH }}
    >
      <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3">
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={theme.colors.primary}
        />
      </View>

      <View className="flex-1 mr-2">
        <Text
          className="text-foreground text-base font-semibold"
          numberOfLines={1}
        >
          {place.name}
        </Text>
        <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>
          {categoryLabel(place.category)}
        </Text>
        <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles (only values that can't be expressed as NativeWind classes)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  floatingBar: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fab: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardListContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
