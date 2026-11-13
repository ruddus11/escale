import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

// 한 장만 마운트해 지도·검색·입력 양식을 중복 실행하지 않는다.
export function useTabSlide<T extends string>(value:T, onChange:(value:T)=>void, enabled:boolean, order:readonly T[]) {
  const progress=useRef(new Animated.Value(0)).current;
  const current=useRef(value), desired=useRef(value);
  const pending=useRef<{value:T;direction:number}|null>(null);
  const busy=useRef(false), sequence=useRef(0), mounted=useRef(true);
  const [sliding,setSliding]=useState(false);
  const [reduceMotion,setReduceMotion]=useState(true);
  const run=useRef<(next:T)=>void>(()=>undefined);
  const commit=useRef(onChange); commit.current=onChange;

  function reset() {
    sequence.current++;
    pending.current=null;
    progress.stopAnimation();
    progress.setValue(0);
    busy.current=false;
    if(mounted.current) setSliding(false);
  }
  function finish(token:number) {
    if(!mounted.current || token!==sequence.current) return;
    busy.current=false;
    setSliding(false);
    if(desired.current!==current.current) run.current(desired.current);
  }
  run.current=(next:T)=>{
    if(next===current.current) return;
    if(!enabled || reduceMotion) {
      reset();
      commit.current(next);
      return;
    }
    const sign=order.indexOf(next)>=order.indexOf(current.current) ? 1 : -1;
    const token=++sequence.current;
    busy.current=true;
    setSliding(true);
    Animated.timing(progress,{toValue:sign,duration:80,easing:Easing.in(Easing.cubic),useNativeDriver:true}).start(({finished})=>{
      if(!finished || !mounted.current || token!==sequence.current) return;
      // 연속해서 눌렀다면 마지막으로 선택한 탭만 연다.
      const target=desired.current;
      if(target===current.current) {
        Animated.timing(progress,{toValue:0,duration:80,useNativeDriver:true}).start(()=>finish(token));
        return;
      }
      pending.current={value:target,direction:sign};
      commit.current(target);
    });
  };
  useLayoutEffect(()=>{
    current.current=value;
    const next=pending.current;
    if(!next || next.value!==value) return;
    pending.current=null;
    const token=sequence.current;
    progress.setValue(-next.direction);
    Animated.timing(progress,{toValue:0,duration:140,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start(({finished})=>{
      if(finished) finish(token);
    });
  },[value]);
  useEffect(()=>{
    mounted.current=true;
    let active=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(flag=>{if(active)setReduceMotion(flag);},()=>undefined);
    const subscription=AccessibilityInfo.addEventListener("reduceMotionChanged",setReduceMotion);
    return ()=>{active=false;mounted.current=false;subscription.remove();sequence.current++;progress.stopAnimation();};
  },[progress]);
  useEffect(()=>{
    if(!enabled) {desired.current=current.current;reset();}
    else if(reduceMotion && busy.current) {
      const target=desired.current;
      reset();
      if(target!==current.current) commit.current(target);
    }
  },[enabled,reduceMotion]);
  return {
    sliding,
    slide(next:T) {desired.current=next;if(!busy.current)run.current(next);},
    style:{
      transform:[{translateX:progress.interpolate({inputRange:[-1,0,1],outputRange:[32,0,-32]})}],
      opacity:progress.interpolate({inputRange:[-1,0,1],outputRange:[0,1,0]}),
    },
  };
}
