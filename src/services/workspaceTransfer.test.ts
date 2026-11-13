import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceBackupFilename,
  downloadJsonFile,
  readTextFile,
  type DownloadEnvironment,
} from "./workspaceTransfer";

describe("workspaceTransfer", () => {
  it("로컬 날짜가 포함된 안정적인 백업 파일명을 만든다", () => {
    expect(
      createWorkspaceBackupFilename(new Date("2026-07-17T09:30:00+09:00")),
    ).toBe("margin-2026-07-17.json");
  });

  it("JSON Blob을 내려받고 임시 URL을 정리한다", () => {
    const anchor = document.createElement("a");
    anchor.click = vi.fn();
    const environment: DownloadEnvironment = {
      createObjectUrl: vi.fn(() => "blob:workspace"),
      revokeObjectUrl: vi.fn(),
      createAnchor: vi.fn(() => anchor),
    };

    downloadJsonFile('{"schemaVersion":1}', "backup.json", environment);

    expect(anchor.download).toBe("backup.json");
    expect(anchor.href).toBe("blob:workspace");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:workspace");
  });

  it("선택한 파일의 텍스트를 읽는다", async () => {
    const file = {
      text: vi.fn().mockResolvedValue('{"schemaVersion":1}'),
    } as unknown as File;

    await expect(readTextFile(file)).resolves.toBe('{"schemaVersion":1}');
  });
});
