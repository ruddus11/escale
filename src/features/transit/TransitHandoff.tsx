import type { Activity } from "../../domain/trip/types";
import { createGoogleMapsTransitUrl } from "../../services/maps";

// 앱 안에서는 대중교통 경로를 조회하지 않는다. 계획 경로만 보여 주고 실제 길찾기는 Google 지도에 맡긴다.
// 출발지를 비워 두면 Google 지도가 현재 위치에서 출발하는 경로를 찾는다.
export function TransitHandoff({ activity }: { activity: Activity }) {
  return (
    <section className="transit-fallback" aria-labelledby="transit-fallback-title">
      <span>다음 이동</span>
      <h2 id="transit-fallback-title">{activity.title}</h2>
      <ol>
        {activity.staticRouteSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <a
        className="transit-fallback__maps-link"
        href={createGoogleMapsTransitUrl(activity.destination)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Google 지도에서 길 보기
      </a>
    </section>
  );
}
