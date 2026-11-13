import { useEffect, useRef, useState } from "react";
import { Animated, ImageBackground, StyleSheet, useWindowDimensions } from "react-native";
import { ease, useReduceMotion } from "./Motion";
import { Seal, Wordmark } from "../theme/mono";
import { mono } from "../theme/tokens";

// 앱을 열 때 잠깐 덮는 항구 장면. 로고 원본(assets/brand/logo-sails-source.jpg)에서 돛을 지운 사진
// (assets/brand/harbor-plain.jpg)을 휴대폰 비율로 자른 것(assets/launch-harbor.jpg) 위에 흰 돛과 이름을 올린다.
// 돛은 화면 폭에 맞춰 그려서 어떤 기기에서도 잘리지 않는다. 기본 실행 화면(app.json splash)과 같은 자리·크기라 이어서 보인다.
const harbor = require("../../assets/launch-harbor.jpg");
const HOLD_MS = 1100;
const FADE_MS = 450;

export function LaunchCurtain() {
  const { width, height } = useWindowDimensions();
  const side = Math.round(width * 0.6);
  const reduce = useReduceMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (reduce) {
        setGone(true);
        return;
      }
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, easing: ease.in, useNativeDriver: true }).start(() => setGone(true));
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [fade, reduce]);
  if (gone) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <ImageBackground source={harbor} resizeMode="cover" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: mono.sea }}>
        <Seal size={side} color={mono.white} />
        {/* 돛은 화면 한가운데(기본 실행 화면과 같은 자리)에 두고, 이름은 돛 아래에 따로 놓는다. */}
        <Wordmark size={30} color={mono.white} style={{ position: "absolute", top: height / 2 + side * 0.36 + 20 }} />
      </ImageBackground>
    </Animated.View>
  );
}
