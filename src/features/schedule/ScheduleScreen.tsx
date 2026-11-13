import { zonedDate, zonedTime } from "../../domain/time/zoned";
import { formatMoney } from "../../domain/money/currency";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  createScheduleDirectionsUrl,
  createScheduleFallbackDirectionsUrl,
  getScheduleMapTarget,
} from "../../data/scheduleMapTargets";
import type {
  ScheduleActivity,
  SchedulePlan,
} from "../../domain/schedule/types";
import { ActivityEditor } from "./ActivityEditor";
import { RestaurantSheet } from "./RestaurantSheet";

interface ScheduleScreenProps {
  plan: SchedulePlan;
  now: Date;
  onChange: (plan: SchedulePlan) => void;
  idFactory?: () => string;
}

const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "UTC",
  weekday: "short",
});



export function ScheduleScreen({
  plan,
  now,
  onChange,
  idFactory,
}: ScheduleScreenProps) {
  const dates = useMemo(
    () => enumerateDates(plan.startDate, plan.endDate),
    [plan.endDate, plan.startDate],
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    clampDate(zonedDate(now, plan.timeZone), plan.startDate, plan.endDate),
  );
  const [editing, setEditing] = useState<
    { kind: "new" } | { kind: "existing"; activityId: string } | null
  >(null);
  const [diningAnchorId, setDiningAnchorId] = useState<string | null>(null);
  const diningReturnFocusId = useRef<string | null>(null);
  useEffect(() => {
    if (diningAnchorId !== null || diningReturnFocusId.current === null) return;
    const id = diningReturnFocusId.current;
    diningReturnFocusId.current = null;
    // 시트가 목록을 대체하므로 닫힌 뒤 새로 그려진 원래 버튼에 초점을 돌린다.
    Array.from(document.querySelectorAll<HTMLButtonElement>("[data-dining-anchor-id]"))
      .find((button) => button.dataset.diningAnchorId === id)?.focus();
  }, [diningAnchorId]);
  const selectedActivities = plan.activities
    .filter((activity) => zonedDate(activity.targetAt, plan.timeZone) === selectedDate)
    .sort(compareActivities);
  const editingActivity =
    editing?.kind === "existing"
      ? plan.activities.find((activity) => activity.id === editing.activityId)
      : undefined;

  function saveActivity(activity: ScheduleActivity) {
    const exists = plan.activities.some((candidate) => candidate.id === activity.id);
    const activities = exists
      ? plan.activities.map((candidate) =>
          candidate.id === activity.id ? activity : candidate,
        )
      : [...plan.activities, activity];

    onChange({ ...plan, activities: [...activities].sort(compareActivities) });
    setSelectedDate(zonedDate(activity.targetAt, plan.timeZone));
    setEditing(null);
  }

  function deleteActivity(activityId: string) {
    onChange({
      ...plan,
      activities: plan.activities.filter(
        (activity) => activity.id !== activityId,
      ),
    });
    setEditing(null);
  }

  function addActivity(activity: ScheduleActivity) {
    onChange({
      ...plan,
      activities: [...plan.activities, activity].sort(compareActivities),
    });
    setDiningAnchorId(null);
  }

  if (editing !== null) {
    return (
      <ActivityEditor
        key={editingActivity?.id ?? `new-${selectedDate}`}
        plan={plan}
        activity={editingActivity}
        defaultDate={selectedDate}
        idFactory={idFactory}
        onSave={saveActivity}
        onDelete={editingActivity === undefined ? undefined : deleteActivity}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const diningAnchor = plan.activities.find(
    (activity) => activity.id === diningAnchorId,
  );
  if (diningAnchor !== undefined && diningAnchor.place !== undefined) {
    return (
      <RestaurantSheet timeZone={plan.timeZone}
        anchor={diningAnchor}
        idFactory={idFactory}
        onAdd={addActivity}
        onClose={() => setDiningAnchorId(null)}
      />
    );
  }

  return (
    <div className="schedule-screen">
      <header className="screen-header">
        <div>
          <p>{plan.title}</p>
          <h1>일정표</h1>
        </div>
        <button type="button" onClick={() => setEditing({ kind: "new" })}>
          <Plus aria-hidden="true" size={18} />
          일정 추가
        </button>
      </header>

      <nav className="schedule-dates" aria-label="일정 날짜 선택">
        {dates.map((date) => {
          const dateObject = new Date(`${date}T00:00:00Z`);
          return (
            <button
              key={date}
              type="button"
              aria-pressed={date === selectedDate}
              onClick={() => setSelectedDate(date)}
            >
              <span>{weekdayFormatter.format(dateObject).replace("요일", "")}</span>
              <strong>{Number(date.slice(8, 10))}</strong>
            </button>
          );
        })}
      </nav>

      <main className="schedule-list">
        <div className="schedule-list__heading">
          <h2>{Number(selectedDate.slice(8, 10))}일 일정</h2>
          <span>{selectedActivities.length}개</span>
        </div>
        {selectedActivities.length === 0 ? (
          <section className="empty-card">
            <h2>등록된 일정이 없습니다</h2>
            <p>이 날의 첫 일정을 추가해보세요.</p>
          </section>
        ) : (
          <ol>
            {selectedActivities.map((activity, index) => {
              const next = selectedActivities[index + 1];
              const mapTarget = getScheduleMapTarget(activity);
              const directionsUrl =
                next === undefined
                  ? null
                  : createScheduleDirectionsUrl(activity, next);
              const fallbackDirectionsUrl =
                next === undefined || directionsUrl !== null
                  ? null
                  : createScheduleFallbackDirectionsUrl(activity, next);
              return (
                <li key={activity.id}>
                  <time dateTime={activity.targetAt}>
                    {zonedTime(activity.targetAt, plan.timeZone)}
                  </time>
                  <div className="schedule-list__content">
                    <strong>{activity.title}</strong>
                    <span>
                      {activity.placeName || "장소 없음"} · {activity.durationMinutes}분
                    </span>
                    <div className="schedule-list__badges">
                      <span>{timeKindLabel(activity)}</span>
                      {activity.routeTimingStale ? (
                        <span className="is-warning">교통편 재확인 필요</span>
                      ) : null}
                      {activity.estimatedCostMinor === undefined ? null : (
                        <span>{formatMoney(activity.estimatedCostMinor, plan.currency)}</span>
                      )}
                    </div>
                  </div>
                  <div className="schedule-list__actions">
                    {mapTarget?.placeUrl === null ||
                    mapTarget?.placeUrl === undefined ? null : (
                      <a
                        href={mapTarget.placeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${activity.title} 장소 보기`}
                      >
                        장소 보기
                      </a>
                    )}
                    {activity.place === undefined ? null : (
                      <button
                        type="button"
                        aria-label={`${activity.title} 주변 맛집`}
                        data-dining-anchor-id={activity.id}
                        onClick={() => {
                          diningReturnFocusId.current = activity.id;
                          setDiningAnchorId(activity.id);
                        }}
                      >
                        주변 맛집
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`${activity.title} 수정`}
                      onClick={() =>
                        setEditing({ kind: "existing", activityId: activity.id })
                      }
                    >
                      수정
                    </button>
                  </div>
                  {directionsUrl !== null && next !== undefined ? (
                    <a
                      className="segment-row__fallback"
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`다음 이동: ${activity.title} → ${next.title} Google 지도에서 길 보기`}
                    >
                      <span>다음 이동 · {activity.title} → {next.title}</span>
                      <strong>Google 지도에서 길 보기</strong>
                    </a>
                  ) : fallbackDirectionsUrl !== null && next !== undefined ? (
                    <a
                      className="segment-row__fallback"
                      href={fallbackDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`현재 위치에서 ${next.title} Google 지도에서 길 보기`}
                    >
                      <span>현재 위치에서 이동 · {next.title}</span>
                      <strong>Google 지도에서 길 보기</strong>
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}

function compareActivities(left: ScheduleActivity, right: ScheduleActivity) {
  return (Date.parse(left.targetAt) - Date.parse(right.targetAt)) || left.id.localeCompare(right.id);
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}


function clampDate(date: string, startDate: string, endDate: string): string {
  if (date < startDate) return startDate;
  if (date > endDate) return endDate;
  return date;
}

function timeKindLabel(activity: ScheduleActivity): string {
  switch (activity.timeKind) {
    case "reservation":
      return "예약";
    case "target":
      return "도착 목표";
    case "estimate":
      return activity.priority === "optional" ? "선택" : "예상";
  }
}
