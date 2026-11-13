export interface DownloadEnvironment {
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  createAnchor(): HTMLAnchorElement;
}

const browserDownloadEnvironment: DownloadEnvironment = {
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  createAnchor: () => document.createElement("a"),
};

export function createWorkspaceBackupFilename(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `margin-${read("year")}-${read("month")}-${read("day")}.json`;
}

export function downloadJsonFile(
  contents: string,
  filename: string,
  environment: DownloadEnvironment = browserDownloadEnvironment,
): void {
  const blob = new Blob([contents], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = environment.createObjectUrl(blob);
  const anchor = environment.createAnchor();

  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    environment.revokeObjectUrl(objectUrl);
  }
}

export async function readTextFile(file: File): Promise<string> {
  return file.text();
}
