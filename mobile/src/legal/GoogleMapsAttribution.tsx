import { Text } from "react-native";
import { mapAttribution, textRole } from "../theme/tokens";

/**
 * Google 장소 정보를 지도 없이 보일 때 붙이는 출처 표시.
 * Google Maps Platform 규칙: "Google Maps"를 번역·줄바꿈하지 않고, 기본 글꼴 400 굵기, 12~16sp,
 * #5E5E5E 같은 정해진 색으로 같은 내용 묶음 안에 둔다. 지우거나 가리면 안 된다.
 * 색은 mapAttribution.text(#5E5E5E), 크기는 attribution(12)로 둔다. 본문 크기로 키우지 않는다(12~16sp 규정).
 * 바탕이 어두운 바다라 규정 색이 읽히도록 크림 쪽지(mapAttribution.plate) 위에 둔다.
 */
export function GoogleMapsAttribution() {
  return (
    <Text accessibilityLabel="Google Maps" numberOfLines={1} style={[textRole.attribution, { letterSpacing: 0, color: mapAttribution.text, backgroundColor: mapAttribution.plate, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2 }]}>
      Google Maps
    </Text>
  );
}
