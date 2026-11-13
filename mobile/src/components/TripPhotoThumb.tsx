import { useState } from "react";
import { Image, Text, View } from "react-native";
import { dayPhotoFile } from "../data/dayPhotoStore";
import type { DayPhoto } from "../data/photoDays";
import { rememberedPlacePhoto } from "../data/recommendLoad";
import { mono, textRole } from "../theme/tokens";

/** 연결된 사용자 사진을 먼저 쓰고, 없으면 현재 세션의 장소 사진과 저작자를 함께 표시한다. */
export function TripPhotoThumb({ photos, date, planId, placeId }: { photos: DayPhoto[]; date: string; planId?: string; placeId?: string }) {
  const own = (planId ? photos.find(p => p.planId === planId) : undefined) ?? photos.find(p => p.date === date);
  const place = !own && placeId ? rememberedPlacePhoto(placeId) : undefined;
  const uri = own ? dayPhotoFile(own.file).uri : place?.uri;
  const [failed, setFailed] = useState<string>();
  if (!uri || failed === uri) return null;
  return <View style={{ width: 66, padding: 3, paddingBottom: 8, backgroundColor: mono.white, transform: [{ rotate: "-3deg" }] }}>
    <Image source={{ uri }} accessible={false} accessibilityIgnoresInvertColors onError={() => setFailed(uri)} style={{ width: 60, height: 60 }} />
    {!!place && <Text style={[textRole.attribution, { color: mono.gray }]}>{["Google", ...place.authors].join(" · ")}</Text>}
  </View>;
}
