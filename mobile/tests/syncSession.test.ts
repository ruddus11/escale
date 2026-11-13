import { describe, expect, it } from "vitest";
import { createSyncSession, applyRemoteNotebook } from "../src/data/syncSession";
import { emptyNotebook, type NotebookData } from "../src/data/model";
import { notebookHash } from "../src/data/cloudSync";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
const edited = (): NotebookData => ({ ...emptyNotebook(), library: { ...emptyNotebook().library, updatedAt: "2026-10-15T02:00:00Z" } });

describe("sync session boundaries", () => {
  it("rejects a download when the local notebook changed before its commit", async () => {
    const session = createSyncSession();
    const token = session.activate("a")!;
    const before = emptyNotebook();
    let local = edited();
    let saved = false;
    await expect(applyRemoteNotebook(session, token, before, { version: 2, payload: emptyNotebook() }, async update => { local = update(local); }, async () => { saved = true; })).rejects.toThrow("local-changed");
    expect(local).toEqual(edited());
    expect(saved).toBe(false);
  });

  it("does not restore an old account after logout or switching accounts", async () => {
    const session = createSyncSession();
    const old = session.activate("a")!;
    session.stop();
    session.activate("b");
    // 새 emptyNotebook()과 비교하면 안 된다. 만들 때마다 updatedAt에 현재 시각(ms)이 들어가 1ms만 지나도 달라진다.
    const empty = emptyNotebook();
    let local = empty;
    let saved = false;
    await expect(applyRemoteNotebook(session, old, local, { version: 2, payload: edited() }, async update => { local = update(local); }, async () => { saved = true; })).rejects.toThrow("session-ended");
    expect(local).toBe(empty);
    expect(saved).toBe(false);
  });

  it("finishes a disk write already started before clearing local data", async () => {
    const session = createSyncSession();
    const token = session.activate("a")!;
    const disk = deferred();
    const started = deferred();
    let local = emptyNotebook();
    let saved = false;
    const downloading = applyRemoteNotebook(session, token, local, { version: 2, payload: edited() }, async update => {
      const next = update(local);
      started.resolve();
      await disk.promise;
      local = next;
    }, async () => { saved = true; }).catch((e: Error) => e.message);
    await started.promise;
    session.stop();
    const cleared = emptyNotebook();
    const clearing = session.clear(async () => { local = cleared; });
    disk.resolve();
    expect(await downloading).toBe("session-ended");
    await clearing;
    expect(local).toBe(cleared);
    expect(saved).toBe(false);
  });

  it("keeps a renewed token for the same user valid but invalidates a new login", () => {
    const session = createSyncSession();
    const first = session.activate("a")!;
    session.activate("a");
    expect(session.current(first)).toBe(true);
    session.stop();
    session.activate("a");
    expect(session.current(first)).toBe(false);
  });

  it("saves metadata only after a successful current-account download", async () => {
    const session = createSyncSession();
    const token = session.activate("a")!;
    let local = emptyNotebook();
    let hash = "";
    await applyRemoteNotebook(session, token, local, { version: 2, payload: edited() }, async update => { local = update(local); }, async state => { hash = state.hash; });
    expect(local).toEqual(edited());
    expect(hash).toBe(notebookHash(local));
  });
  it("discards an old upload acknowledgement queued behind a disk operation", async () => {
    const session = createSyncSession();
    const token = session.activate("a")!;
    const disk = deferred();
    const started = deferred();
    const writing = session.run(token, async () => { started.resolve(); await disk.promise; }).catch(() => undefined);
    await started.promise;
    let metadata = "";
    const acknowledgement = session.run(token, async () => { metadata = "old-account"; }).catch((e: Error) => e.message);
    session.stop();
    const clear = session.clear(async () => { metadata = ""; });
    disk.resolve();
    await writing;
    expect(await acknowledgement).toBe("session-ended");
    await clear;
    expect(metadata).toBe("");
    const next = session.activate("b")!;
    await session.run(next, async () => { metadata = "new-account"; });
    expect(metadata).toBe("new-account");
  });

  it("does not mark a failed notebook write as backed up", async () => {
    const session = createSyncSession();
    const token = session.activate("a")!;
    let saved = false;
    await expect(applyRemoteNotebook(session, token, emptyNotebook(), { version: 2, payload: edited() }, async () => { throw new Error("disk-full"); }, async () => { saved = true; })).rejects.toThrow("disk-full");
    expect(saved).toBe(false);
    let cleared = false;
    await session.clear(async () => { cleared = true; });
    expect(cleared).toBe(true);
  });

});
