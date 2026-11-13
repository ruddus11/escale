import { useEffect,useRef,useState,type ReactNode } from "react";
import {
AccessibilityInfo,
Animated,
Easing,
Pressable,type AccessibilityRole,
type AccessibilityState,
type StyleProp,type ViewStyle
} from "react-native";
import { curve,duration } from "../theme/motion";

export const ease = {
  out: Easing.bezier(...curve.out),
  in: Easing.bezier(...curve.in),
  stamp: Easing.bezier(...curve.stamp),
};

// 동작 줄이기 설정은 앱에서 한 번만 읽어 둔다. 화면이 뜬 뒤에 읽으면 첫 등장 모션이 이미 지나가 버린다.
let reduceMotion: boolean | null = null;
const listeners = new Set<(flag: boolean) => void>();
function publish(flag: boolean) {
  reduceMotion = flag;
  listeners.forEach((listener) => listener(flag));
}
void AccessibilityInfo.isReduceMotionEnabled().then(publish, () => publish(false));
AccessibilityInfo.addEventListener("reduceMotionChanged", publish);

/** 설정을 아직 못 읽었으면 움직이지 않는 쪽으로 둔다. */
export function useReduceMotion(): boolean {
  const [flag, setFlag] = useState(reduceMotion ?? true);
  useEffect(() => {
    if (reduceMotion !== null) setFlag(reduceMotion);
    listeners.add(setFlag);
    return () => {
      listeners.delete(setFlag);
    };
  }, []);
  return flag;
}

/**
 * 누르면 종이가 살짝 눌리는 버튼. 투명도만 바꾸던 눌림을 대신한다.
 * lift를 주면 눌리는 대신 집어 든 것처럼 조금 커진다(책·사진).
 */
export function PressScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  lift = false,
  label,
  hint,
  role = "button",
  state,
  hitSlop,
}: {
  children: ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  lift?: boolean;
  label?: string;
  hint?: string;
  role?: AccessibilityRole;
  state?: AccessibilityState;
  hitSlop?: number;
}) {
  const reduce = useReduceMotion();
  const pressed = useRef(new Animated.Value(0)).current;
  function to(value: number) {
    Animated.timing(pressed, {
      toValue: value,
      duration: value ? duration.press : duration.press * 2,
      easing: ease.out,
      useNativeDriver: true,
    }).start();
  }
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, ...state }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      style={style}
    >
      <Animated.View
        style={{
          opacity: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, lift ? 1 : 0.72] }),
          transform: reduce
            ? []
            : [{ scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, lift ? 1.035 : 0.965] }) }],
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** 붙인 것이 자리 잡는 등장. 조금 위에서 내려와 멈춘다. delay로 여러 장을 차례로 놓는다. */
export function Settle({
  children,
  delay = 0,
  from = 12,
  style,
}: {
  children: ReactNode;
  delay?: number;
  /** 시작 위치(pt). 양수면 아래에서, 음수면 위에서 온다. */
  from?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      return;
    }
    const run = Animated.timing(progress, {
      toValue: 1,
      delay,
      duration: duration.settle,
      easing: ease.out,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [reduce]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
