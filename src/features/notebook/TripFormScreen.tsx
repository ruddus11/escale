import { ReservationManager } from "../reservations/ReservationManager";
import { deviceTimeZone } from "../../domain/time/zoned";
import { useState, type FormEvent } from "react";
import { Button } from "@astryxdesign/core/Button";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Plus, X } from "lucide-react";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { APP_COLUMN_MAX_WIDTH } from "../../app/frame";
import { SUPPORTED_CURRENCIES, isCurrencyCode } from "../../domain/money/currency";
import {
  validateTripForm,
  type TripFormInput,
  type TripFormIssue,
} from "../../domain/workspace/tripForm";
import type { CoverColor, TripWorkspace } from "../../domain/workspace/types";

interface TripFormScreenProps {
  mode: "create" | "edit";
  initial: TripFormInput;
  /** 수정할 때 넘기면 총무와 장부에 있는 동행자를 지킨다. */
  trip?: TripWorkspace;
  onSubmit: (input: TripFormInput) => void;
  backHref: string;
}

const issueMessages: Record<TripFormIssue, string> = {
  title: "여행 이름을 적어 주세요.",
  reservations: "예약 입력 내용을 확인해 주세요.",
  "time-zone": "올바른 IANA 시간대를 선택해 주세요.",
  currency: "지원 통화를 선택해 주세요.",
  "currency-in-use": "금액 기록이 있는 통화는 변경할 수 없어요. 기존 금액을 다른 통화로 바꾸지 않도록 새 수첩을 만들어 주세요.",
  "schedule-dates": "기존 일정이 여행 기간 밖으로 나가요. 날짜와 시간대를 확인해 주세요.",
  destination: "여행지는 120자 이내로 적어 주세요.",
  dates: "출발일과 도착일을 순서대로 골라 주세요.",
  "too-long": "수첩 한 권은 60일까지 쓸 수 있어요.",
  members: "동행자는 1명부터 20명까지 적을 수 있어요.",
  "member-name": "빈 이름이 있어요.",
  "duplicate-member": "같은 이름이 두 번 있어요. 구분할 수 있게 고쳐 주세요.",
  "owner-removed": "총무(나)는 뺄 수 없어요.",
  "member-in-use": "경비 기록에 나온 사람은 뺄 수 없어요. 이름만 고칠 수 있어요.",
};

const coverColors: ReadonlyArray<{ value: CoverColor; label: string }> = [
  { value: "cobalt", label: "코발트" },
  { value: "ink", label: "잉크" },
  { value: "sky", label: "하늘" },
];

/** 새 수첩 만들기와 여행 설정 고치기가 같이 쓰는 양식 */
export function TripFormScreen({ mode, initial, trip, onSubmit, backHref }: TripFormScreenProps) {
  const [input, setInput] = useState<TripFormInput>(initial);
  const [step, setStep] = useState<"info" | "reservations">("info");
  const [editingReservation, setEditingReservation] = useState(false);
  const [reservationNow] = useState(() => new Date());
  const [issues, setIssues] = useState<TripFormIssue[]>([]);
  const title = mode === "create" ? "새 수첩" : "여행 설정";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingReservation) return;
    const nextIssues = validateTripForm(input, trip);
    setIssues(nextIssues);
    if (nextIssues.length === 0) {
      if (mode === "create" && step === "info") setStep("reservations");
      else onSubmit(input);
    }
  }

  function setMemberName(index: number, name: string) {
    setInput((current) => ({
      ...current,
      members: current.members.map((member, at) => (at === index ? { ...member, name } : member)),
    }));
  }

  return (
    <VStack className="trip-form-screen" gap={5} maxWidth={APP_COLUMN_MAX_WIDTH}>
      <Link href={backHref} isStandalone>
        ‹ 돌아가기
      </Link>
      <Heading level={1} className="notebook-title notebook-rule">
        {title}
      </Heading>

      <form className="trip-form-screen__form" onSubmit={submit} noValidate aria-label={title}>
      <VStack gap={5}>
        {mode === "create" ? <p className="reservation-step-label">{step === "info" ? "1 / 2 · 여행 기본정보" : "2 / 2 · 예약 넣기"}</p> : null}
        <div hidden={step !== "info"} style={{ display: step === "info" ? "contents" : "none" }}>
        <TextInput
          label="여행 이름"
          value={input.title}
          onChange={(value) => setInput((current) => ({ ...current, title: value }))}
          placeholder="예: 겨울 여행"
        />

        <TextInput
          label="여행지 (선택)"
          value={input.destination ?? ""}
          onChange={(value) => setInput((current) => ({ ...current, destination: value }))}
          placeholder="국가 또는 도시 · 나중에 입력해도 돼요"
        />

        <VStack gap={3}>
          <DateInput
            label="출발"
            value={asIsoDate(input.startDate)}
            onChange={(value) => setInput((current) => ({ ...current, startDate: value ?? "" }))}
          />
          <DateInput
            label="도착"
            value={asIsoDate(input.endDate)}
            min={asIsoDate(input.startDate)}
            onChange={(value) => setInput((current) => ({ ...current, endDate: value ?? "" }))}
          />
        </VStack>

        <VStack gap={2}>
          <Text weight="semibold" size="sm">
            정산 통화
          </Text>
          <select aria-label="정산 통화" value={input.baseCurrency} onChange={event => {
            if (isCurrencyCode(event.target.value)) setInput(current => ({ ...current, baseCurrency: event.target.value as TripFormInput["baseCurrency"] }));
          }}>
            {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
          <label>현지 통화
            <select aria-label="현지 통화" value={input.localCurrency ?? input.baseCurrency} onChange={event => {
              if (isCurrencyCode(event.target.value)) setInput(current => ({ ...current, localCurrency: event.target.value as TripFormInput["baseCurrency"] }));
            }}>
              {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <label>여행 시간대
            <input aria-label="여행 시간대" list="trip-time-zones" value={input.timeZone ?? deviceTimeZone()} onChange={event => setInput(current => ({ ...current, timeZone: event.target.value }))} />
            <datalist id="trip-time-zones">
              {["UTC", ...Intl.supportedValuesOf("timeZone")].map(zone => <option key={zone} value={zone} />)}
            </datalist>
          </label>
        </VStack>

        <VStack as="fieldset" className="trip-form-screen__members" gap={2}>
          <legend className="trip-form-screen__legend">
            <Text as="span" weight="semibold" size="sm">
              동행자
            </Text>
          </legend>
          {input.members.map((member, index) => (
            <HStack key={member.id ?? `new-${index}`} gap={2} align="end">
              <TextInput
                label={index === 0 ? "동행자 1 (총무, 나)" : `동행자 ${index + 1}`}
                value={member.name}
                onChange={(value) => setMemberName(index, value)}
              />
              {index === 0 ? null : (
                <IconButton
                  label={`동행자 ${index + 1} 빼기`}
                  variant="ghost"
                  icon={<Icon icon={X} />}
                  onClick={() =>
                    setInput((current) => ({
                      ...current,
                      members: current.members.filter((_, at) => at !== index),
                    }))
                  }
                />
              )}
            </HStack>
          ))}
          <Button
            label="동행자 더하기"
            variant="ghost"
            icon={<Icon icon={Plus} />}
            isDisabled={input.members.length >= 20}
            onClick={() =>
              setInput((current) => ({ ...current, members: [...current.members, { name: "" }] }))
            }
          />
          <Text type="supporting" size="sm">
            초대나 계정 없이, 정산에 쓸 이름만 적어요.
          </Text>
        </VStack>

        <VStack gap={2}>
          <Text weight="semibold" size="sm">
            표지 색
          </Text>
          <SegmentedControl
            label="표지 색"
            value={input.coverColor}
            onChange={(value) => {
              const color = coverColors.find((candidate) => candidate.value === value);
              if (color !== undefined) setInput((current) => ({ ...current, coverColor: color.value }));
            }}
          >
            {coverColors.map((color) => (
              <SegmentedControlItem key={color.value} value={color.value} label={color.label} />
            ))}
          </SegmentedControl>
        </VStack>

        </div>
        {step === "reservations" ? <div className="reservation-onboarding reservation-manager"><ReservationManager items={input.reservations ?? []} timeZone={input.timeZone ?? deviceTimeZone()} startDate={input.startDate} now={reservationNow} onChange={reservations => setInput(current => ({ ...current, reservations }))} onEditingChange={setEditingReservation} /><div className="reservation-step-actions"><button type="button" disabled={editingReservation} onClick={() => setStep("info")}>‹ 기본정보 수정</button>{!input.reservations?.length && !editingReservation ? <p className="reservation-caption">예약은 수첩을 만든 뒤에도 추가할 수 있어요.</p> : null}</div></div> : null}
        {issues.length === 0 ? null : (
          <VStack as="ul" role="alert" className="trip-form-screen__issues" gap={1}>
            {issues.map((issue) => (
              <li key={issue}>
                <Text as="span" size="sm" weight="semibold">
                  {issueMessages[issue]}
                </Text>
              </li>
            ))}
          </VStack>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isDisabled={editingReservation}
          label={mode === "create" ? (step === "info" ? "다음: 예약 넣기" : "수첩 만들기") : "설정 저장"}
        />
      </VStack>
      </form>
    </VStack>
  );
}

function asIsoDate(value: string): ISODateString | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? (value as ISODateString) : undefined;
}
