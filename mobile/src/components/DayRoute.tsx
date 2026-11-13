import { useEffect, useState } from "react";
import { Alert, PanResponder, Pressable, Text, View } from "react-native";
import type { MapTarget } from "../data/dayPlan";
import { todayStore } from "../data/sqlite";
import { moveItem, nearestOrder, reconcileOrder } from "../data/dayRoute";
import { DayMap, type LocatedState } from "./DayMap";
import { mono, textRole } from "../theme/tokens";
import { translateNow, useI18n } from "../i18n/I18n";

export function DayRoute({
  tripId,
  date,
  targets,
  located,
  onOpen,
  onSignIn,
  onGesture,
}: {
  tripId: string;
  date: string;
  targets: MapTarget[];
  located: LocatedState;
  onOpen: (target: MapTarget) => void;
  onSignIn?: () => void;
  onGesture: (active: boolean) => void;
}) {
  const { t } = useI18n();
  const key = `dayRoute:${tripId}:${date}`;
  const [saved, setSaved] = useState<string[]>([]);
  const [undo, setUndo] = useState<string[]>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setReady(false);
    setSaved([]);
    setUndo(undefined);
    void todayStore
      .get(key)
      .then((raw) => {
        const value: unknown = JSON.parse(raw ?? "[]");
        if (!Array.isArray(value) || value.some((v) => typeof v !== "string"))
          throw Error("Invalid order");
        if (alive) {
          setSaved(value);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive)
          Alert.alert(translateNow("route.readFailed"), translateNow("route.reselect"));
      });
    return () => {
      alive = false;
      onGesture(false);
    };
  }, [key]);
  const ids = reconcileOrder(
    saved,
    targets.map((t) => t.id),
  );
  const rows = ids.map((id) => targets.find((t) => t.id === id)!);
  const points = ids.flatMap((id, index) => {
    const point = located.points.find((p) => p.id === id);
    return point ? [{ ...point, routeNumber: index + 1 }] : [];
  });
  async function save(next: string[], isUndo = false) {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await todayStore.set(key, JSON.stringify(next));
      setSaved(next);
      setUndo(isUndo ? undefined : ids);
    } catch {
      Alert.alert(t("route.saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  const missing = rows.length - points.length;
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* 계획 탭의 장 제목 아래 묶음이라 묶음 제목 크기로 둔다. 한 화면에 화면 이름은 하나다. */}
        <Text accessibilityRole="header" style={[textRole.sectionTitle, { color: mono.ink }]}>{t("route.title")}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={!ready || busy || points.length < 2}
          onPress={() => {
            const lodging = points.find((p) => p.id.startsWith("sleep-"));
            const sorted = nearestOrder(points, lodging);
            void save([...sorted, ...ids.filter((id) => !sorted.includes(id))]);
          }}
          style={{
            minHeight: 44,
            justifyContent: "center",
            opacity: ready && points.length > 1 ? 1 : 0.4,
          }}
        >
          <Text style={[textRole.meta, { color: mono.accentText, fontWeight: "600" }]}>
            {t("route.sort")}
          </Text>
        </Pressable>
      {undo && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("route.undoA11y")}
          disabled={busy}
          onPress={() =>
            void save(
              reconcileOrder(
                undo,
                targets.map((t) => t.id),
              ),
              true,
            )
          }
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[textRole.meta, { color: mono.accentText, fontWeight: "600" }]}>
            {t("route.undo")}
          </Text>
        </Pressable>
      )}
      </View>
      <DayMap
        targets={rows}
        located={{ ...located, points }}
        onOpen={onOpen}
        onSignIn={onSignIn}
        height={360}
      />
      <Text style={[textRole.meta, { color: mono.gray }]}>
        {t("route.hint")}
        {missing ? ` ${t("route.missing", { n: missing })}` : ""}
      </Text>
      {rows.map((row, index) => (
        <RouteRow
          key={row.id}
          title={row.title}
          index={index}
          count={rows.length}
          disabled={!ready || busy}
          onGesture={onGesture}
          onOpen={() => onOpen(row)}
          onMove={(to) => void save(moveItem(ids, index, to))}
        />
      ))}

    </View>
  );
}
function RouteRow({
  title,
  index,
  count,
  disabled,
  onGesture,
  onOpen,
  onMove,
}: {
  title: string;
  index: number;
  count: number;
  disabled: boolean;
  onGesture: (v: boolean) => void;
  onOpen: () => void;
  onMove: (to: number) => void;
}) {
  const { t } = useI18n();
  const [offset, setOffset] = useState(0);
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => onGesture(true),
    onPanResponderMove: (_, g) => setOffset(g.dy),
    onPanResponderRelease: (_, g) => {
      setOffset(0);
      onGesture(false);
      const to = Math.max(
        0,
        Math.min(count - 1, index + Math.round(g.dy / 60)),
      );
      if (to !== index) onMove(to);
    },
    onPanResponderTerminate: () => {
      setOffset(0);
      onGesture(false);
    },
    onPanResponderTerminationRequest: () => false,
  });
  return (
    <View
      style={{
        minHeight: 60,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 1,
        borderColor: mono.hair,
        backgroundColor: offset ? mono.accentSoft : "transparent",
        transform: [{ translateY: offset }],
        zIndex: offset ? 10 : 0,
      }}
    >
      <Text style={[textRole.label, { color: mono.accentText, width: 24 }]}>
        {index + 1}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={{ flex: 1, minHeight: 60, justifyContent: "center" }}
      >
        <Text style={[textRole.itemTitle, { color: mono.ink }]}>{title}</Text>
      </Pressable>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("route.rowA11y", { title, n: index + 1 })}
        accessibilityActions={[
          { name: "increment", label: t("route.down") },
          { name: "decrement", label: t("route.up") },
        ]}
        onAccessibilityAction={(e) => {
          if (!disabled)
            onMove(
              Math.max(
                0,
                Math.min(
                  count - 1,
                  index + (e.nativeEvent.actionName === "increment" ? 1 : -1),
                ),
              ),
            );
        }}
        style={{
          width: 48,
          minHeight: 60,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 24, color: mono.gray }}>≡</Text>
      </View>
    </View>
  );
}
