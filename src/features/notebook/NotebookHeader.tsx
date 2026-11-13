import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { BookOpen, Ellipsis } from "lucide-react";
import type { NotebookTab } from "../../app/screens";
import type { TripSettings } from "../../domain/workspace/types";
import { formatTripDates } from "./formatTripDates";

interface NotebookHeaderProps {
  settings: TripSettings;
  activeTab: NotebookTab;
  onSelectTab: (tab: NotebookTab) => void;
  onOpenMenu: () => void;
}

const tabs: ReadonlyArray<{ id: NotebookTab; label: string }> = [
  { id: "plan", label: "일정" },
  { id: "places", label: "장소" },
  { id: "budget", label: "경비" },
  { id: "bookings", label: "예약" },
];

function isNotebookTab(value: string): value is NotebookTab {
  return tabs.some((tab) => tab.id === value);
}

/** 수첩 제목(누르면 표지), 메뉴, 위쪽 탭 4칸 */
export function NotebookHeader({
  settings,
  activeTab,
  onSelectTab,
  onOpenMenu,
}: NotebookHeaderProps) {
  return (
    <VStack as="header" className="notebook-header" gap={1}>
      <HStack justify="between" align="center" gap={2}>
        <Link href="#covers" className="notebook-header__title" aria-label={`${settings.title} 수첩, 표지로 가기`}>
          <HStack as="span" gap={2} align="center">
            <Icon icon={BookOpen} />
            <VStack as="span" gap={0}>
              <Text as="span" className="notebook-title" size="xl" weight="bold">
                {settings.title}
              </Text>
              <Text as="span" type="supporting" size="sm" hasTabularNumbers>
                {formatTripDates(settings.startDate, settings.endDate)} · {settings.members.length}명
              </Text>
            </VStack>
          </HStack>
        </Link>
        <IconButton
          label="수첩 메뉴"
          variant="ghost"
          icon={<Icon icon={Ellipsis} />}
          onClick={onOpenMenu}
        />
      </HStack>
      <TabList
        className="notebook-tabs"
        aria-label="수첩 칸"
        value={activeTab}
        onChange={(value) => {
          if (isNotebookTab(value)) onSelectTab(value);
        }}
        layout="fill"
      >
        {tabs.map((tab) => (
          <Tab key={tab.id} value={tab.id} label={tab.label} />
        ))}
      </TabList>
    </VStack>
  );
}
