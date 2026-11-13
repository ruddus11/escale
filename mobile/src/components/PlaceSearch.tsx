import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { locatePlace, newSessionToken, suggestPlaces, type PlaceSuggestion } from "../data/places";
import { placeCacheStore } from "../data/sqlite";
import { usePlaceAccess } from "../data/usePlaceAccess";
import { KeyedError } from "../i18n/errors";
import { isLimitKey } from "../data/usageLimit";
import { useI18n } from "../i18n/I18n";
import { GoogleMapsAttribution } from "../legal/GoogleMapsAttribution";
import { Icon } from "../theme/mono";
import { mono, textRole } from "../theme/tokens";
import { Field } from "./ui";

// 입력이 멈추면 찾는다. 글자마다 부르면 자동완성 요금이 쌓인다.
const TYPING_PAUSE_MS = 350;

export interface PickedPlace {
  placeId: string;
  name: string;
  address: string;
}

/** 계획·가고 싶은 곳 편집의 장소 찾기. 고르면 이름·주소·장소 ID를 넘기고, 위치는 기기 캐시에 넣는다. */
export function PlaceSearch({ onPick }: { onPick: (place: PickedPlace) => void }) {
  const { t, lang } = useI18n();
  const access = usePlaceAccess();
  const [text, setText] = useState("");
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [state, setState] = useState<"idle" | "searching" | "none" | "error">("idle");
  const [message, setMessage] = useState("");
  const [limited, setLimited] = useState(false);
  // 찾기 한 번(자동완성 여러 번 + 고르기)을 한 요금으로 묶는다. 고르면 새로 만든다.
  const session = useRef(newSessionToken());
  const ready = access.ready && !!access.baseUrl;

  useEffect(() => {
    const query = text.trim();
    if (!ready || query.length < 2) {
      setItems([]);
      setState("idle");
      return;
    }
    let alive = true;
    setState("searching");
    const timer = setTimeout(() => {
      suggestPlaces({ baseUrl: access.baseUrl, credential: access.credential, lang, text: query, sessionToken: session.current }).then(
        (found) => {
          if (!alive) return;
          setItems(found);
          setState(found.length ? "idle" : "none");
        },
        (e) => {
          if (!alive) return;
          setItems([]);
          setState("error");
          setMessage(e instanceof KeyedError ? t(e.key) : t("place.failed"));
          setLimited(e instanceof KeyedError && isLimitKey(e.key));
        },
      );
    }, TYPING_PAUSE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [text, ready, access.baseUrl, access.credential, lang, t]);

  async function pick(item: PlaceSuggestion) {
    setState("searching");
    try {
      const point = await locatePlace({ baseUrl: access.baseUrl, credential: access.credential, lang, placeId: item.placeId, sessionToken: session.current });
      session.current = newSessionToken();
      await placeCacheStore
        .set(`id:${point.placeId}`, { latitude: point.latitude, longitude: point.longitude, placeId: point.placeId, at: new Date().toISOString() })
        .catch(() => undefined);
      onPick({ placeId: point.placeId, name: item.name, address: point.address || item.detail });
      setText("");
      setItems([]);
      setState("idle");
    } catch (e) {
      setState("error");
      setMessage(e instanceof KeyedError ? t(e.key) : t("place.failed"));
      setLimited(e instanceof KeyedError && isLimitKey(e.key));
    }
  }

  if (!ready) return <Text style={[textRole.meta, { color: mono.gray }]}>{t(access.baseUrl ? "map.loading" : "place.noServer")}</Text>;
  return (
    <View style={{ gap: 6 }}>
      <Field label={t("place.search")} value={text} onChangeText={setText} placeholder={t("place.searchHint")} returnKeyType="search" maxLength={120} />
      {state === "searching" && <Text style={[textRole.meta, { color: mono.gray }]}>{t("place.searching")}</Text>}
      {items.map((item) => (
        <Pressable
          key={item.placeId}
          accessibilityRole="button"
          accessibilityLabel={[item.name, item.detail].filter(Boolean).join(", ")}
          onPress={() => void pick(item)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderBottomWidth: 1, borderColor: mono.hair, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name="pin" size={16} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={[textRole.itemTitle, { color: mono.ink }]}>{item.name}</Text>
            {!!item.detail && <Text numberOfLines={1} style={[textRole.meta, { color: mono.gray }]}>{item.detail}</Text>}
          </View>
        </Pressable>
      ))}
      {!!items.length && (
        <View style={{ alignItems: "flex-end", paddingTop: 2 }}>
          <GoogleMapsAttribution />
        </View>
      )}
      {state === "none" && <Text style={[textRole.meta, { color: mono.gray }]}>{t("place.none")}</Text>}
      {state === "error" && <Text style={[textRole.meta, { color: limited ? mono.ink : mono.warn }]}>{message}</Text>}
    </View>
  );
}
