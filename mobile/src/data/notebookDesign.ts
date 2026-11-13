import { libraryCoverIds } from "./libraryCovers";
export const coverStyles = libraryCoverIds;
export type CurrentCoverStyle = typeof coverStyles[number];
export const legacyCoverStyles = ["travelerLeather", "silverBinding", "vellumJournal", "midnightPassport", "silverRoute", "ivoryPostcard", "charcoalTicket", "canvasAtlas", "oxbloodVoyage", "indigoRail", "oliveField", "mistCoast", "noirScrapbook", "blackSilver", "silverPress", "boneArchive", "ink", "sky", "cobalt", "forest", "grid", "stripe"] as const;
export type CoverStyle = CurrentCoverStyle | typeof legacyCoverStyles[number];
// 예전 백업은 읽되 선택 목록과 렌더링에는 새 컬렉션만 사용한다.
const legacyCoverMap: Record<typeof legacyCoverStyles[number], CurrentCoverStyle> = {
  travelerLeather:"ogive", silverBinding:"ironwork", vellumJournal:"folio",
  midnightPassport:"ogive", silverRoute:"ironwork", ivoryPostcard:"roseWindow",
  charcoalTicket:"lunar", canvasAtlas:"folio", oxbloodVoyage:"thorn",
  indigoRail:"lunar", oliveField:"reliquary", mistCoast:"exLibris", noirScrapbook:"palimpsest",
  blackSilver:"ogive", silverPress:"ironwork", boneArchive:"folio",
  ink:"ogive", sky:"roseWindow", cobalt:"vespers", forest:"reliquary", grid:"exLibris", stripe:"folio",
};
export function resolveCover(cover: CoverStyle): CurrentCoverStyle {
  return Object.hasOwn(legacyCoverMap, cover) ? legacyCoverMap[cover as keyof typeof legacyCoverMap] : cover as CurrentCoverStyle;
}
// 예전 "첫 장 바로가기" 목록. 화면에서는 더 쓰지 않지만 저장된 디자인과 백업 형식을 지키려고 키는 남긴다.
export const sectionOptions = [{ key: "plan" }, { key: "place" }, { key: "reservations" }, { key: "budget" }, { key: "journal" }] as const;
export type SectionKey = typeof sectionOptions[number]["key"];
export type PaperStyle = "ruled" | "dots" | "plain";
export interface NotebookDesign {
  cover: CoverStyle;
  sections: SectionKey[];
  paper: PaperStyle;
}
export function defaultDesign(cover: CoverStyle = "ogive"): NotebookDesign {
  return { cover, sections: sectionOptions.map(s => s.key), paper: "ruled" };
}
export function isNotebookDesign(value: unknown): value is NotebookDesign {
  if (!value || typeof value !== "object") return false;
  const d = value as NotebookDesign;
  return Object.keys(d).length === 3 && Object.keys(d).every(k => ["cover", "sections", "paper"].includes(k))
    && [...coverStyles, ...legacyCoverStyles].includes(d.cover) && ["ruled", "dots", "plain"].includes(d.paper)
    && Array.isArray(d.sections) && d.sections.length <= sectionOptions.length
    && new Set(d.sections).size === d.sections.length
    && d.sections.every(key => sectionOptions.some(s => s.key === key));
}
// 공유 웹 형식은 유지하고, 추가 표지 모양은 모바일 디자인 메타데이터로 저장한다.
export function fallbackCover(cover: CoverStyle): "ink" | "sky" | "cobalt" {
  const current = resolveCover(cover);
  return ["roseWindow", "exLibris", "folio", "palimpsest", "cloister", "ribbon", "colophon"].includes(current) ? "sky" : "ink";
}
