// app.json에 더해, 저장소에 두지 않는 Google 지도 키를 환경 변수에서 읽는다.
// 키는 mobile/.env의 EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY(scripts/set-ios-maps-key.sh로 넣는다)와 EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY.
// 이 키는 앱 ID로만 쓰게 잠근 키라 앱 안에 들어가도 되지만, 공개 저장소에 올리면 남이 할당량을 쓸 수 있다.
// 키가 없으면 그 플랫폼에서는 계획 탭 지도를 그리지 않는다. 키를 넣거나 바꾸면 네이티브 빌드를 다시 한다.
// Android는 키 없이 Google 지도를 띄우면 앱이 종료되므로, 화면은 extra.googleMaps의 참/거짓만 보고 지도를 고른다(키 값은 넣지 않는다).
// 스토어 제출용 빌드에는 유료 미리보기를 넣지 않는다(App Store 3.1.1). 살 수 없는 유료 기능과 접근 코드 입력칸이 보이게 되기 때문이다.
// EAS는 빌드 환경에 EAS_BUILD_PROFILE을 넣는다. production 프로필에 EXPO_PUBLIC_PAID_PREVIEW=1이 있으면 빌드를 멈춘다.
function assertReleaseIsFree(env) {
  if (env.EAS_BUILD_PROFILE === "production" && env.EXPO_PUBLIC_PAID_PREVIEW?.trim() === "1") {
    throw new Error("EXPO_PUBLIC_PAID_PREVIEW=1 is for internal test builds only. Remove it from the production build profile.");
  }
}

module.exports = ({ config }) => {
  assertReleaseIsFree(process.env);
  const iosGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY?.trim();
  const androidGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY?.trim();
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ["react-native-maps", { ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}), ...(androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}) }],
    ],
    extra: { ...(config.extra ?? {}), googleMaps: { ios: !!iosGoogleMapsApiKey, android: !!androidGoogleMapsApiKey } },
  };
};
module.exports.assertReleaseIsFree = assertReleaseIsFree;
