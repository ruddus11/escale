import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, TurboModuleRegistry, UIManager, View } from "react-native";
import type MapViewType from "react-native-maps";
import type { MapTarget } from "../data/dayPlan";
import { googleMapViewName, googleMapsReady, mapView, nativeMapProvider, placeAccessState, type PlaceAccessState } from "../data/mapView";
import { cacheKey, findPlace, isFresh, locatePlace, type CachedPoint } from "../data/places";
import { placeCacheStore } from "../data/sqlite";
import { usePlaceAccess } from "../data/usePlaceAccess";
import { useI18n } from "../i18n/I18n";
import type { Lang } from "../i18n/strings";
import { Chevron, Icon, LineButton } from "../theme/mono";
import { diary, mono, radius, textRole } from "../theme/tokens";

// 밤바다 틀에 맞춘 어두운 해도. 가게 아이콘은 숨겨 일정 핀만 눈에 띄게 하고, 역·노선은 남긴다.
// 색은 토큰에서만 가져온다. 땅은 깊은 바다, 길은 물빛 선, 물은 바탕 바다색이다.
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: diary.inset }] },
  { elementType: "labels.text.fill", stylers: [{ color: mono.gray }] },
  { elementType: "labels.text.stroke", stylers: [{ color: diary.inset }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: diary.surface }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: diary.surface }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: diary.edge }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: mono.soft }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: mono.coral }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: mono.bg }] },
];

// iOS는 기본 Apple 지도를 쓴다. Android는 키 없이 지도를 띄우면 종료되므로 기존 빌드 확인을 유지한다.
const googleInBuild = googleMapsReady({
  platform: Platform.OS,
  nativeModule: TurboModuleRegistry.get("RNMapsAirModule") != null,
  googleView: !!UIManager.hasViewManagerConfig?.(googleMapViewName(Platform.OS)),
  keys: (Constants.expoConfig?.extra as { googleMaps?: { ios?: unknown; android?: unknown } } | undefined)?.googleMaps,
});
const provider = nativeMapProvider(Platform.OS, googleInBuild);
const Maps: typeof import("react-native-maps") | null = provider ? require("react-native-maps") : null;

// 실패한 위치 찾기는 앱을 다시 열거나 사용자가 다시 시도를 누를 때까지 다시 묻지 않는다(오타 주소로 요금이 쌓이지 않게).
const tried = new Set<string>();
// 실패한 곳은 화면을 다시 그려도 자리표시가 남도록 따로 기억한다.
const failedKeys = new Set<string>();
// 날짜를 바꿨다가 돌아와도 진행 중인 조회 결과를 이어 받아 빈 준비 칸에 갇히지 않게 한다.
const inFlight = new Map<string, Promise<CachedPoint | null>>();
let purged = false;

export type Located = MapTarget & { latitude: number; longitude: number; routeNumber?: number };

/**
 * 위치 찾기 결과. failed는 이번에 찾지 못한 곳 수, retry는 사용자가 누를 때만 그곳들을 다시 묻는다.
 * pending은 아직 좌표도 실패도 없는 곳 수, access는 서버를 쓸 수 있는지다. 빈 지도 자리를 설명하는 데 쓴다.
 */
export interface LocatedState {
  points: Located[];
  failed: number;
  pending: number;
  access: PlaceAccessState;
  retry: () => void;
}

/**
 * 그날 지도. 오늘 탭 지도 띠는 낮게 쓰고, 출발 전에는 순서가 없는 곳들이라 경로선을 뺀다.
 * 찾을 곳이 없으면 그리지 않는다. 좌표가 없을 때는 이유(준비 중·로그인 필요·빌드 설정·실패)를 같은 높이의 흑백 칸으로 알린다.
 * 화면이 이미 위치를 찾았으면 located로 넘긴다. 같은 곳을 두 번 찾지 않게 하려는 것이다.
 * onSignIn은 로그인 화면으로 갈 수 있을 때만 넘긴다. 없으면 안내만 보인다.
 */
export function DayMap({ targets, located: given, onOpen, onSignIn, height = 220, route = true }: { targets: MapTarget[]; located?: LocatedState; onOpen: (target: MapTarget) => void; onSignIn?: () => void; height?: number; route?: boolean }) {
  const { t } = useI18n();
  const own = useLocatedTargets(given ? [] : targets);
  const { points, failed, pending, access, retry } = given ?? own;
  const view = mapView({ points: points.length, failed, pending, access, maps: !!Maps });
  if (view === "none") return null;
  if (view === "loading") return <MapLoading height={height} />;
  if (view === "signIn") return <MapNotice height={height} title={t("map.signIn")} hint={t("map.signInHint")} action={onSignIn && { title: t("map.signInAction"), onPress: onSignIn }} />;
  if (view === "unavailable" && points.length > 0) return <PlaceList points={points} onOpen={onOpen} />;
  if (view === "unconfigured" || view === "unavailable") return <MapNotice height={height} title={t("map.unavailable")} hint={t("map.unavailableHint")} />;
  // 여기까지 오면 view는 map 또는 failed다. map이면 Maps가 있다.
  if (view === "failed" || !Maps) return <MapNotice height={height} title={t("map.failed")} hint={t("map.failedHint")} action={{ title: t("map.retry"), onPress: retry }} />;
  return (
    <View style={{ gap: 8 }}>
      <MapCard maps={Maps} points={points} onOpen={onOpen} height={height} route={route} />
      {failed > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={[textRole.meta, { flex: 1, color: mono.gray }]}>{t("map.partial", { n: failed })}</Text>
          <LineButton title={t("map.retry")} onPress={retry} style={{ minHeight: 44, paddingHorizontal: 14 }} />
        </View>
      )}
    </View>
  );
}

/** 좌표가 없을 때 지도 자리를 지키는 흑백 칸. 실패·로그인 필요·지도를 쓸 수 없는 빌드에 같이 쓴다. */
function MapNotice({ height, title, hint, action }: { height: number; title: string; hint: string; action?: { title: string; onPress: () => void } }) {
  return (
    <View accessibilityRole="alert" style={{ minHeight: height, padding: 20, gap: 10, alignItems: "center", justifyContent: "center", borderRadius: radius.card, overflow: "hidden", backgroundColor: diary.surface }}>
      <Icon name="pin" size={28} color={mono.gray} />
      <Text style={[textRole.itemTitle, { color: mono.ink, textAlign: "center" }]}>{title}</Text>
      <Text style={[textRole.meta, { color: mono.gray, textAlign: "center" }]}>{hint}</Text>
      {action && <LineButton title={action.title} onPress={action.onPress} style={{ alignSelf: "stretch", marginTop: 6 }} />}
    </View>
  );
}

/** 지도를 그릴 수 없는 빌드에서 핀 대신 보이는 번호 목록. 순서와 누르면 여는 곳은 지도 핀과 같다. */
function PlaceList({ points, onOpen }: { points: Located[]; onOpen: (target: MapTarget) => void }) {
  const { t } = useI18n();
  return (
    <View style={{ borderWidth: 1, borderColor: mono.hair, backgroundColor: diary.page, paddingHorizontal: 16, paddingVertical: 8 }}>
      <Text style={[textRole.meta, { color: mono.gray, paddingVertical: 8 }]}>{t("map.unavailable")}</Text>
      {points.map((point, i) => (
        <Pressable key={point.id} accessibilityRole="button" accessibilityLabel={t("place.pin", { n: point.routeNumber ?? i + 1, title: point.title })} onPress={() => onOpen(point)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: mono.hair }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: mono.ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={[textRole.label, { color: mono.ink }]}>{point.routeNumber ?? i + 1}</Text>
          </View>
          <Text numberOfLines={1} style={[textRole.itemTitle, { flex: 1, color: mono.ink }]}>{point.title}</Text>
          <Chevron />
        </Pressable>
      ))}
    </View>
  );
}

/** 로그인 상태를 읽거나 위치를 찾는 동안의 조용한 칸. 곧 바뀌므로 알림으로 읽히지 않게 한다. */
function MapLoading({ height }: { height: number }) {
  const { t } = useI18n();
  return (
    <View accessible accessibilityLabel={t("map.loading")} style={{ minHeight: height, padding: 20, gap: 10, alignItems: "center", justifyContent: "center", borderRadius: radius.card, overflow: "hidden", backgroundColor: diary.surface }}>
      <Icon name="pin" size={28} color={mono.soft} />
      <Text style={[textRole.meta, { color: mono.gray, textAlign: "center" }]}>{t("map.loading")}</Text>
    </View>
  );
}

/** 지도 핀과 경로에 쓸 위치. 기기 캐시를 먼저 보고, 없으면 서버에서 한 번 찾는다. */
export function useLocatedTargets(targets: MapTarget[]): LocatedState {
  const { lang } = useI18n();
  const access = usePlaceAccess();
  return useLocated(targets, access, lang);
}

function useLocated(targets: MapTarget[], access: { baseUrl: string; credential: string; ready: boolean; canSignIn: boolean }, lang: Lang): LocatedState {
  const [found, setFound] = useState<Record<string, CachedPoint>>({});
  // 이번에 찾지 못한 곳(오프라인·서버 오류·결과 없음). 다시 시도를 누르기 전까지는 묻지 않는다.
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const signature = targets.map((target) => cacheKey(target)).join("|");
  useEffect(() => {
    let alive = true;
    const keys = [...new Set(targets.map((target) => cacheKey(target)).filter((key): key is string => !!key))];
    const miss = (key: string) => alive && setMissed((prev) => new Set(prev).add(key));
    setMissed(new Set([...keys].filter((key) => failedKeys.has(key))));
    void (async () => {
      const now = new Date();
      if (!purged) {
        purged = true;
        await placeCacheStore.purge(now).catch(() => undefined);
      }
      const cached = await placeCacheStore.get(keys).catch(() => ({}) as Record<string, CachedPoint>);
      const fresh = Object.fromEntries(Object.entries(cached).filter(([, point]) => isFresh(point, now)));
      if (alive) setFound(fresh);
      if (!access.ready || !access.baseUrl) return;
      const started = new Set<string>();
      for (const target of targets) {
        const key = cacheKey(target);
        if (!key || fresh[key] || started.has(key)) continue;
        started.add(key);
        const pendingLookup = inFlight.get(key);
        if (pendingLookup) {
          const entry = await pendingLookup;
          if (entry) {
            if (alive) setFound((prev) => ({ ...prev, [key]: entry }));
          } else miss(key);
          continue;
        }
        if (tried.has(key)) {
          // 지난 조회가 캐시에 남지 않았으면 준비 중 칸에 갇히지 않게 한다.
          failedKeys.add(key);
          miss(key);
          continue;
        }
        tried.add(key);
        const lookup = (async (): Promise<CachedPoint | null> => {
          try {
            const call = { baseUrl: access.baseUrl, credential: access.credential, lang };
            const point = target.placeId ? await locatePlace({ ...call, placeId: target.placeId }) : await findPlace({ ...call, text: target.address ?? "" });
            if (!point) {
              failedKeys.add(key);
              return null;
            }
            failedKeys.delete(key);
            const entry: CachedPoint = { latitude: point.latitude, longitude: point.longitude, placeId: point.placeId, at: new Date().toISOString() };
            await placeCacheStore.set(key, entry).catch(() => undefined);
            return entry;
          } catch {
            // 오프라인이거나 서버가 응답하지 않으면 핀 없이 두고 다시 시도 버튼을 보인다.
            failedKeys.add(key);
            return null;
          }
        })();
        inFlight.set(key, lookup);
        const entry = await lookup;
        inFlight.delete(key);
        if (entry) {
          if (alive) setFound((prev) => ({ ...prev, [key]: entry }));
        } else miss(key);
      }
    })();
    return () => {
      alive = false;
    };
    // targets 내용은 signature로 본다. 같은 장소면 다시 찾지 않는다.
  }, [signature, access.credential, access.baseUrl, access.ready, lang, attempt]);
  const points = targets.flatMap((target) => {
    const point = found[cacheKey(target) ?? ""];
    return point ? [{ ...target, latitude: point.latitude, longitude: point.longitude }] : [];
  });
  const failed = targets.filter((target) => {
    const key = cacheKey(target);
    return !!key && missed.has(key) && !found[key];
  }).length;
  const pending = targets.filter((target) => {
    const key = cacheKey(target);
    return !!key && !missed.has(key) && !found[key];
  }).length;
  function retry() {
    // 실패한 곳만 "이미 물어봄" 표시를 지우고 다시 돈다. 성공한 곳은 캐시에서 바로 읽는다.
    for (const key of missed) {
      tried.delete(key);
      failedKeys.delete(key);
    }
    setMissed(new Set());
    setAttempt((n) => n + 1);
  }
  return { points, failed, pending, access: placeAccessState(access), retry };
}

function MapCard({ maps, points, onOpen, height, route }: { maps: typeof import("react-native-maps"); points: Located[]; onOpen: (target: MapTarget) => void; height: number; route: boolean }) {
  const { t } = useI18n();
  const { default: MapView, Marker, Polyline, PROVIDER_GOOGLE } = maps;
  const map = useRef<MapViewType>(null);
  const coordinates = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  const shape = coordinates.map((c) => `${c.latitude},${c.longitude}`).join(";");
  function fit() {
    if (coordinates.length === 1) map.current?.animateToRegion({ ...coordinates[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 0);
    else map.current?.fitToCoordinates(coordinates, { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: false });
  }
  useEffect(fit, [shape]);
  return (
    <View accessibilityLabel={t("place.map")} style={{ height, borderRadius: radius.card, overflow: "hidden" }}>
      <MapView
        ref={map}
        provider={provider === "google" ? PROVIDER_GOOGLE : undefined}
        mapType={provider === "apple" ? "mutedStandard" : "standard"}
        style={{ flex: 1 }}
        customMapStyle={MAP_STYLE}
        onMapReady={fit}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
      >
        {route && coordinates.length > 1 && <Polyline coordinates={coordinates} strokeColor={mono.ink} strokeWidth={2} lineDashPattern={[6, 5]} />}
        {points.map((point, i) => (
          <Marker key={point.id} coordinate={{ latitude: point.latitude, longitude: point.longitude }} onPress={() => onOpen(point)} accessibilityLabel={t("place.pin", { n: point.routeNumber ?? i + 1, title: point.title })}>
            <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: mono.accent, borderWidth: 2, borderColor: mono.onInk, alignItems: "center", justifyContent: "center" }}>
                <Text style={[textRole.label, { color: mono.onInk }]}>{point.routeNumber ?? i + 1}</Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
