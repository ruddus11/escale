import { Badge, type BadgeProps } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

interface ScheduleStatusPanelProps {
  phase: "empty" | "before" | "active" | "complete";
}

const statusContent = {
  empty: {
    title: "일정 확인 필요",
    description: "표시할 일정이 없습니다.",
    badge: "확인",
    badgeVariant: "orange",
  },
  before: {
    title: "출발 준비 완료",
    description: "항공편과 첫날 일정을 확인했습니다.",
    badge: "출발 전",
    badgeVariant: "blue",
  },
  active: {
    title: "여행 진행 중",
    description: "다음 일정의 시각과 이동 경로를 확인하세요.",
    badge: "진행",
    badgeVariant: "green",
  },
  complete: {
    title: "오늘 일정 완료",
    description: "오늘의 일정을 모두 마쳤습니다.",
    badge: "완료",
    badgeVariant: "blue",
  },
} as const satisfies Record<
  ScheduleStatusPanelProps["phase"],
  {
    title: string;
    description: string;
    badge: string;
    badgeVariant: NonNullable<BadgeProps["variant"]>;
  }
>;

export function ScheduleStatusPanel({ phase }: ScheduleStatusPanelProps) {
  const content = statusContent[phase];

  return (
    <Card variant="muted">
      <HStack
        as="section"
        aria-labelledby="schedule-status-title"
        justify="between"
        align="start"
        gap={3}
      >
        <VStack gap={1}>
          <Text type="supporting" size="sm" weight="semibold">
            현재 일정
          </Text>
          <Heading level={2} id="schedule-status-title">
            {content.title}
          </Heading>
          <Text type="supporting" as="p">
            {content.description}
          </Text>
        </VStack>
        <Badge variant={content.badgeVariant} label={content.badge} />
      </HStack>
    </Card>
  );
}
