import { useState, type FormEvent } from "react";
import type { AttachedPlace } from "../../domain/places/types";
import type {
  ScheduleActivity,
  SchedulePlan,
} from "../../domain/schedule/types";
import {
  createActivityDraft,
  saveActivityDraft,
  validateActivityDraft,
  type ActivityDraft,
  type ActivityDraftErrors,
} from "./activityDraft";
import { PlaceSearchField } from "./PlaceSearchField";

interface ActivityEditorProps {
  plan: SchedulePlan;
  activity?: ScheduleActivity;
  defaultDate: string;
  idFactory?: () => string;
  onSave: (activity: ScheduleActivity) => void;
  onDelete?: (activityId: string) => void;
  onCancel: () => void;
}

const fieldLabels: Partial<Record<keyof ActivityDraft, string>> = {
  title: "일정 이름",
  date: "날짜",
  time: "시각",
  placeName: "장소",
  durationMinutes: "체류시간",
  estimatedCostMinor: "예상비용",
  notes: "메모",
};

export function ActivityEditor({
  plan,
  activity,
  defaultDate,
  idFactory,
  onSave,
  onDelete,
  onCancel,
}: ActivityEditorProps) {
  const [draft, setDraft] = useState(() =>
    createActivityDraft(activity, defaultDate, plan.timeZone, plan.currency),
  );
  const [errors, setErrors] = useState<ActivityDraftErrors>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  function updateField<K extends keyof ActivityDraft>(
    field: K,
    value: ActivityDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateActivityDraft(draft, plan);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave(saveActivityDraft(draft, plan, activity, idFactory));
  }

  const firstErrorField = Object.keys(errors)[0] as
    | keyof ActivityDraft
    | undefined;
  const errorSummary =
    firstErrorField === undefined
      ? null
      : `${fieldLabels[firstErrorField] ?? "입력값"}을 확인해주세요.`;

  return (
    <section className="activity-editor" aria-labelledby="activity-editor-title">
      <header className="activity-editor__header">
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <h1 id="activity-editor-title">
          {activity === undefined ? "새 일정 등록" : "일정 수정"}
        </h1>
        <span aria-hidden="true" />
      </header>

      <form onSubmit={submit} noValidate>
        {errorSummary === null ? null : <p role="alert">{errorSummary}</p>}

        <label>
          일정 이름
          <input
            value={draft.title}
            maxLength={80}
            onChange={(event) => updateField("title", event.target.value)}
            aria-invalid={errors.title === undefined ? undefined : true}
          />
          {errors.title === undefined ? null : <small>{errors.title}</small>}
        </label>

        <div className="activity-editor__two-column">
          <label>
            날짜
            <input
              type="date"
              min={plan.startDate}
              max={plan.endDate}
              value={draft.date}
              onChange={(event) => updateField("date", event.target.value)}
              aria-invalid={errors.date === undefined ? undefined : true}
            />
          </label>
          <label>
            시각
            <input
              type="time"
              value={draft.time}
              onChange={(event) => updateField("time", event.target.value)}
              aria-invalid={errors.time === undefined ? undefined : true}
            />
          </label>
        </div>

        <PlaceSearchField
          placeName={draft.placeName}
          place={draft.place}
          error={errors.placeName}
          onPlaceNameChange={(placeName) => {
            setDraft((current) => {
              const next = { ...current, placeName };
              delete next.place;
              return next;
            });
            setErrors((current) => {
              if (current.placeName === undefined) return current;
              const next = { ...current };
              delete next.placeName;
              return next;
            });
          }}
          onPlaceSelect={(place: AttachedPlace) => {
            setDraft((current) => ({
              ...current,
              place,
              placeName: place.displayName,
            }));
            setErrors((current) => {
              if (current.placeName === undefined) return current;
              const next = { ...current };
              delete next.placeName;
              return next;
            });
          }}
          onPlaceClear={() =>
            setDraft((current) => {
              const next = { ...current };
              delete next.place;
              return next;
            })
          }
        />

        <div className="activity-editor__two-column">
          <label>
            종류
            <select
              value={draft.kind}
              onChange={(event) =>
                updateField(
                  "kind",
                  event.target.value as ActivityDraft["kind"],
                )
              }
            >
              <option value="note">메모</option>
              <option value="transport">이동</option>
              <option value="flight">항공</option>
              <option value="accommodation">숙소</option>
              <option value="shopping">쇼핑</option>
              <option value="meal">식사</option>
              <option value="sightseeing">관광</option>
              <option value="cafe">카페</option>
            </select>
          </label>
          <label>
            체류시간 (분)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="720"
              value={draft.durationMinutes}
              onChange={(event) =>
                updateField("durationMinutes", event.target.value)
              }
              aria-invalid={
                errors.durationMinutes === undefined ? undefined : true
              }
            />
          </label>
        </div>

        <div className="activity-editor__two-column">
          <label>
            우선순위
            <select
              value={draft.priority}
              onChange={(event) =>
                updateField(
                  "priority",
                  event.target.value as ActivityDraft["priority"],
                )
              }
            >
              <option value="required">필수</option>
              <option value="flexible">유동</option>
              <option value="optional">선택</option>
            </select>
          </label>
          <label>
            시간 기준
            <select
              value={draft.timeKind}
              onChange={(event) =>
                updateField(
                  "timeKind",
                  event.target.value as ActivityDraft["timeKind"],
                )
              }
            >
              <option value="reservation">예약시간</option>
              <option value="target">도착 목표</option>
              <option value="estimate">예상시간</option>
            </select>
          </label>
        </div>

        <label>
          예상비용 ({plan.currency === "JPY" ? "엔" : plan.currency})
          <input
            inputMode="decimal"
            value={draft.estimatedCostMinor}
            placeholder="모르면 비워두기"
            onChange={(event) =>
              updateField("estimatedCostMinor", event.target.value)
            }
            aria-invalid={
              errors.estimatedCostMinor === undefined ? undefined : true
            }
          />
        </label>

        <label>
          메모
          <textarea
            value={draft.notes}
            maxLength={500}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </label>

        {activity?.routeTimingStale ? (
          <p className="activity-editor__notice">
            변경된 시각에 맞춰 교통편을 다시 확인해주세요.
          </p>
        ) : null}

        <button className="activity-editor__save" type="submit">
          일정 저장
        </button>

        {activity === undefined || onDelete === undefined ? null : (
          <div className="activity-editor__delete">
            {isConfirmingDelete ? (
              <>
                <strong>{activity.title}</strong>
                <p>이 일정을 정말 삭제할까요?</p>
                <button type="button" onClick={() => onDelete(activity.id)}>
                  정말 삭제
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                >
                  유지
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setIsConfirmingDelete(true)}>
                일정 삭제
              </button>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
