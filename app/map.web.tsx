/**
 * Web / Electron fallback for the Places map screen.
 *
 * Metro picks this file over `map.tsx` on web because
 * `@maplibre/maplibre-react-native` is a native-only module — it does not
 * support the web at all. Instead we show a centered EmptyState explaining
 * that the map is only available on the mobile app.
 */

import { View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, ScreenHeader } from "../src/ui/components";
import { t } from "../src/i18n";

export default function MapWebScreen() {
  const router = useRouter();

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
    >
      <ScreenHeader title={t("map.title")} onBack={() => router.back()} />
      <View className="flex-1 items-center justify-center px-6">
        <EmptyState
          icon="map-marker-off"
          title={t("map.webOnly.title")}
          subtitle={t("map.webOnly.subtitle")}
        />
      </View>
    </SafeAreaView>
  );
}
