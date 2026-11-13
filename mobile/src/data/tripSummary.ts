import type { ExpenseCategory } from "../../../src/domain/workspace/types";
import type { CurrencyCode } from "../../../src/domain/money/types";
import { formatMoney } from "../../../src/domain/money/currency";
import type { PageEntry } from "./model";
import { translate,type Lang } from "../i18n/strings";

const MARKER = "[margin-trip-summary:v1]";
const PHOTO = "[margin-photo:";
export interface TripSummary {
  days: number;
  records: number;
  spend: { category: ExpenseCategory; currency: CurrencyCode; amount: number }[];
  places: { title: string; count: number }[];
  photos: string[];
}

export function summaryText(summary: TripSummary, lang: Lang): string {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);
  const lines = [MARKER, t("summary.days", { n: summary.days }), t("summary.records", { n: summary.records })];
  if (summary.spend.length) lines.push("", t("summary.spend"), ...summary.spend.map((row) => `${t(`summary.category.${row.category}`)} · ${formatMoney(row.amount, row.currency)}`));
  if (summary.places.length) lines.push("", t("summary.places"), ...summary.places.map((row) => t("summary.placeCount", { name: row.title, n: row.count })));
  if (!summary.spend.length && !summary.places.length && !summary.records) lines.push("", t("summary.empty"));
  if (summary.photos.length) lines.push("", t("summary.photos"), ...summary.photos.map((file) => `${PHOTO}${file}]`));
  return lines.join("\n").slice(0, 2000);
}

export function isTripSummaryPage(page: Pick<PageEntry, "kind" | "body">): boolean {
  return page.kind === "journal" && page.body.startsWith(MARKER);
}

export function summaryPageContent(body: string): { text: string; photos: string[] } {
  if (!body.startsWith(MARKER)) return { text: body, photos: [] };
  const lines = body.split("\n");
  return { text: lines.filter((line) => line !== MARKER && !line.startsWith(PHOTO)).join("\n").trim(), photos: lines.filter((line) => line.startsWith(PHOTO) && line.endsWith("]")).map((line) => line.slice(PHOTO.length, -1)).slice(0, 3) };
}

/** 편집할 때 내부 표식과 기존 사진 참조를 보존한다. */
export function replaceSummaryText(original: string, editedText: string): string {
  if (!original.startsWith(MARKER)) return editedText;
  const photos = summaryPageContent(original).photos;
  return [MARKER, editedText.trim(), ...photos.map((file) => `${PHOTO}${file}]`)].join("\n").slice(0, 2000);
}
