import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { notebookDay } from "./notebookView";
export function selectFeaturedTrip(trips:TripWorkspace[],now:Date) {
 const live=trips.filter(t=>!t.settings.archived);
 const current=live.filter(t=>notebookDay(t.settings,now).phase==="during").sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const upcoming=live.filter(t=>notebookDay(t.settings,now).phase==="before").sort((a,b)=>a.settings.startDate.localeCompare(b.settings.startDate));
 return current[0] ?? upcoming[0] ?? [...trips].sort((a,b)=>b.settings.endDate.localeCompare(a.settings.endDate))[0];
}
