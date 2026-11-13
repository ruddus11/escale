import { Image, Text, View, type ImageSourcePropType } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import type { PassportStamp } from "../data/passport";
import { stampCountry, type StampShape } from "../data/stampCountries";
import { stableTilt } from "../theme/motion";
import { mono } from "../theme/tokens";
import { useI18n } from "../i18n/I18n";
import type { Lang } from "../i18n/strings";

// 나라별 도장 그림. PNG를 assets/stamps/에 넣고 여기에 연결한다.
// 예: JP: require("../../assets/stamps/jp.png"). 그림이 없는 나라는 아래 대체 도장(모양·잉크·글자)을 그린다.
const stampArt: Partial<Record<string, ImageSourcePropType>> = {};

// 고무도장을 종이에 눌렀을 때 잉크가 덜 묻는 자리. 종이 높이 사진(CC0)의 오목한 곳을 뽑은 반점이다(assets/passport/CREDITS.md).
// 반점을 사증 종이색으로 칠해 도장 위에 얹는다. 같은 도장은 늘 같은 각도로 돌려 반점 자리가 도장마다 다르게 보인다.
const wear = require("../../assets/passport/stamp-wear.png");

const SIZE = 132;

/** 바깥 테두리와 안쪽 테두리를 같은 모양으로 두 겹 긋는다. 고무도장처럼 보이게 하는 최소한의 표현이다. */
function Outline({ shape, ink }: { shape: StampShape; ink: string }) {
  const outer = { stroke: ink, strokeWidth: 3, fill: "none" };
  const inner = { stroke: ink, strokeWidth: 1.2, fill: "none" };
  const c = SIZE / 2;
  switch (shape) {
    case "circle":
      return <><Circle cx={c} cy={c} r={c - 3} {...outer} /><Circle cx={c} cy={c} r={c - 10} {...inner} /></>;
    case "oval":
      return <><Ellipse cx={c} cy={c} rx={c - 3} ry={c - 20} {...outer} /><Ellipse cx={c} cy={c} rx={c - 10} ry={c - 27} {...inner} /></>;
    case "rect":
      return <><Rect x={4} y={22} width={SIZE - 8} height={SIZE - 44} rx={6} {...outer} /><Rect x={10} y={28} width={SIZE - 20} height={SIZE - 56} rx={3} {...inner} /></>;
    case "hexagon": {
      const hex = (r: number) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`; }).join(" ");
      return <><Path d={`M${hex(c - 3)}Z`} {...outer} /><Path d={`M${hex(c - 11)}Z`} {...inner} /></>;
    }
    case "octagon": {
      const oct = (r: number) => Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 4) * i + Math.PI / 8; return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`; }).join(" ");
      return <><Path d={`M${oct(c - 3)}Z`} {...outer} /><Path d={`M${oct(c - 11)}Z`} {...inner} /></>;
    }
    case "diamond":
      return <><Path d={`M${c} 3 L${SIZE - 3} ${c} L${c} ${SIZE - 3} L3 ${c}Z`} {...outer} /><Path d={`M${c} 13 L${SIZE - 13} ${c} L${c} ${SIZE - 13} L13 ${c}Z`} {...inner} /></>;
    case "arch":
      return <><Path d={`M8 ${SIZE - 14} V${c} A${c - 8} ${c - 8} 0 0 1 ${SIZE - 8} ${c} V${SIZE - 14}Z`} {...outer} /><Path d={`M15 ${SIZE - 21} V${c} A${c - 15} ${c - 15} 0 0 1 ${SIZE - 15} ${c} V${SIZE - 21}Z`} {...inner} /></>;
  }
}

const dotted = (date: string) => date.replaceAll("-", ".");
const countryName = (code: string, lang: Lang) => {
  const c = stampCountry(code);
  if (!c) return code;
  return lang === "ja" ? c.name.ja : lang === "ko" ? c.name.ko : c.name.en;
};

/** 여권 도장 한 개. 나라마다 모양과 잉크가 다르고, 같은 도장은 늘 같은 각도로 살짝 기운다. */
export function Stamp({ stamp }: { stamp: PassportStamp }) {
  const { t, lang } = useI18n();
  const country = stampCountry(stamp.country);
  const ink = country?.ink ?? mono.accent;
  const art = stampArt[stamp.country];
  const name = countryName(stamp.country, lang);
  return (
    <View
      accessible
      accessibilityLabel={t("passport2.stampA11y", { country: name, city: stamp.city, date: dotted(stamp.date) })}
      style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center", transform: [{ rotate: `${stableTilt(stamp.id, 7)}deg` }] }}
    >
      {art ? (
        <Image source={art} accessible={false} style={{ width: SIZE, height: SIZE }} resizeMode="contain" />
      ) : (
        <>
          <Svg width={SIZE} height={SIZE} style={{ position: "absolute", opacity: 0.9 }}>
            <Outline shape={country?.shape ?? "circle"} ink={ink} />
          </Svg>
          <View style={{ alignItems: "center", maxWidth: SIZE - 34, gap: 1 }}>
            <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 9, lineHeight: 12, fontWeight: "600", letterSpacing: 1.6, color: ink }}>
              {(country?.name.en ?? stamp.country).toUpperCase()}
            </Text>
            <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 17, lineHeight: 22, fontWeight: "700", color: ink }}>
              {name}
            </Text>
            <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11, lineHeight: 14, fontWeight: "500", color: ink }}>
              {stamp.city}
            </Text>
            <Text allowFontScaling={false} style={{ fontSize: 10, lineHeight: 14, fontWeight: "600", letterSpacing: 0.6, fontVariant: ["tabular-nums"], color: ink }}>
              {dotted(stamp.date)}
            </Text>
          </View>
        </>
      )}
      <Image source={wear} accessible={false} tintColor={mono.visaPaper} resizeMode="cover"
        style={{ position: "absolute", width: SIZE, height: SIZE, transform: [{ rotate: `${stableTilt(`${stamp.id}:wear`, 180)}deg` }] }} />
    </View>
  );
}

export { countryName };
