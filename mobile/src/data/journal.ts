import type { PageEntry } from "./model";

function firstLine(body: string) {
  // 기존 백업의 120자 제목 제한을 지키되 이모지의 서로게이트 쌍은 자르지 않는다.
  return body.trim().split(/\r?\n/, 1)[0].trim().slice(0, 120).replace(/[\uD800-\uDBFF]$/, "").trimEnd();
}

export function journalHeading(page: Pick<PageEntry, "title" | "body">) {
  return page.title.trim() === firstLine(page.body) ? "" : page.title.trim();
}

export function prepareJournal(page: PageEntry): PageEntry | undefined {
  const body = page.body.trim();
  const title = page.title.trim() || firstLine(body);
  if (!title) return undefined;
  return { ...page, title, body };
}
