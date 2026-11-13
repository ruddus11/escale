import { emptyNotebook, parseNotebook, type NotebookData } from "./model";
export interface NotebookDriver {
  read(): Promise<string | null>;
  write(json: string): Promise<void>;
}
export function createNotebookRepository(driver: NotebookDriver) {
  return {
    async load(): Promise<NotebookData> {
      const raw = await driver.read();
      return raw === null ? emptyNotebook() : parseNotebook(raw);
    },
    async save(data: NotebookData): Promise<void> {
      const json = JSON.stringify(data);
      parseNotebook(json);
      await driver.write(json);
    },
  };
}
