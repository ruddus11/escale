import { useState } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { TripSettings } from "../../domain/workspace/types";

interface NotebookMenuProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  settings: TripSettings;
  canRemove: boolean;
  onOpenSettings: () => void;
  onToggleArchived: () => void;
  onOpenBookings: () => void;
  onRemove: () => void;
}

/** 수첩 머리글의 ··· 메뉴. 지우기는 확인 대화상자를 한 번 더 거친다. */
export function NotebookMenu({
  isOpen,
  onOpenChange,
  settings,
  canRemove,
  onOpenSettings,
  onToggleArchived,
  onOpenBookings,
  onRemove,
}: NotebookMenuProps) {
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

  return (
    <>
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width="min(420px, 92vw)">
        <DialogHeader title={`${settings.title} 수첩`} onOpenChange={onOpenChange} />
        <VStack gap={3}>
          <List hasDividers>
            <ListItem
              label="여행 설정"
              description="이름 · 날짜 · 정산 통화 · 동행자 · 표지"
              onClick={onOpenSettings}
            />
            <ListItem
              label={settings.archived ? "쓰는 수첩으로 되돌리기" : "다 쓴 수첩으로 옮기기"}
              description="표지 목록에서 자리만 바뀌어요. 언제든 되돌릴 수 있어요."
              onClick={onToggleArchived}
            />
            <ListItem
              label="백업 · 초기화"
              description="예약 탭 아래 '백업 및 복구' 칸에서 할 수 있어요"
              onClick={onOpenBookings}
            />
            <ListItem
              label="수첩 지우기"
              description={
                canRemove
                  ? "일정·장소·경비가 모두 지워져요"
                  : "마지막 한 권은 지울 수 없어요"
              }
              isDisabled={!canRemove}
              onClick={() => setIsConfirmingRemove(true)}
            />
          </List>
          <Text type="supporting" size="sm">
            로그인이 없어서 이 기기와 백업 파일에만 저장돼요.
          </Text>
        </VStack>
      </Dialog>
      <AlertDialog
        isOpen={isConfirmingRemove}
        onOpenChange={setIsConfirmingRemove}
        title={`${settings.title} 수첩을 지울까요?`}
        description="일정·장소·경비가 모두 지워지고 되돌릴 수 없어요. 필요하면 먼저 백업 파일을 내보내 주세요."
        actionLabel="지우기"
        cancelLabel="취소"
        onAction={() => {
          setIsConfirmingRemove(false);
          onRemove();
        }}
      />
    </>
  );
}
