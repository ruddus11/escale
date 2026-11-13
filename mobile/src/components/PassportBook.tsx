import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { ease, useReduceMotion } from "./Motion";
import { TextLink } from "../theme/mono";
import { mono, textRole } from "../theme/tokens";

// 여권 한 권. 처음엔 표지가 덮여 있고, 표지를 누르면 왼쪽 철한 자리를 축으로 표지가 넘어가며 사증 면이 드러난다.
// 표지가 다 넘어간 뒤 도장이 하나씩 종이에 찍힌다(StampDrop). 동작 줄이기를 켜 두면 넘김 없이 바로 펼친다.
const BookOpen = createContext(false);

const TURN_MS = 720;

export function PassportBook({ cover, children, openLabel, hint, closeLabel }: { cover: ReactNode; children: ReactNode; openLabel: string; hint: string; closeLabel: string }) {
  const reduce = useReduceMotion();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(0);
  const turn = useRef(new Animated.Value(0)).current;

  function toggle(next: boolean) {
    setOpen(next);
    if (reduce) {
      turn.setValue(next ? 1 : 0);
      return;
    }
    Animated.timing(turn, { toValue: next ? 1 : 0, duration: TURN_MS, easing: next ? ease.out : ease.in, useNativeDriver: true }).start();
  }

  // 표지는 반쯤 넘어가면(세로로 선 순간) 사라진다. 뒷면은 그리지 않는다.
  const rotateY = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-180deg"] });
  const coverOpacity = turn.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  // 사증 면은 표지 그늘에서 밝아지듯 드러난다.
  const pageOpacity = turn.interpolate({ inputRange: [0, 0.3, 0.7], outputRange: [0, 0.35, 1] });

  return (
    <View style={{ gap: 10 }}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <BookOpen.Provider value={open}>
          <Animated.View accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"} style={{ opacity: pageOpacity }}>
            {children}
          </Animated.View>
        </BookOpen.Provider>
        <Animated.View
          pointerEvents={open ? "none" : "auto"}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            opacity: coverOpacity,
            transform: [{ perspective: 1400 }, { translateX: -width / 2 }, { rotateY }, { translateX: width / 2 }],
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel={openLabel} accessibilityElementsHidden={open} onPress={() => toggle(true)} style={{ flex: 1 }}>
            {cover}
          </Pressable>
        </Animated.View>
      </View>
      {open
        ? <TextLink title={closeLabel} tone="dismiss" onPress={() => toggle(false)} style={{ alignSelf: "flex-end" }} />
        : <Text style={[textRole.meta, { color: mono.gray, textAlign: "center" }]}>{hint}</Text>}
    </View>
  );
}

/** 사증 면의 도장 하나. 여권이 펼쳐지고 나면 순서대로 내려와 종이에 찍힌다. */
export function StampDrop({ index, children }: { index: number; children: ReactNode }) {
  const open = useContext(BookOpen);
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) {
      v.setValue(0);
      return;
    }
    if (reduce) {
      v.setValue(1);
      return;
    }
    const run = Animated.timing(v, { toValue: 1, duration: 260, delay: TURN_MS * 0.8 + Math.min(index, 7) * 150, easing: ease.stamp, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [open, reduce, index, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1.55, 1] });
  const opacity = v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] });
  return <Animated.View style={{ opacity, transform: [{ scale }] }}>{children}</Animated.View>;
}
