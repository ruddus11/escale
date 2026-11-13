import { describe, expect, it } from "vitest";
import { notebookOwnerGate, prepareNotebookOwner, signOutThenClear } from "../src/data/accountBoundary";

describe("account boundary", () => {
  it("keeps the previous owner across expiry until device data is cleared", async () => {
    let owner: string | null = "previous";
    const store = { load: async () => owner, save: async (value: string) => { owner = value; } };
    expect(await prepareNotebookOwner("next", store)).toBe("switch");
    expect(owner).toBe("previous");
    expect(await prepareNotebookOwner("previous", store)).toBe("same");
    owner = null;
    expect(await prepareNotebookOwner("next", store)).toBe("new");
    expect(owner).toBe("next");
  });

  it("blocks sync without offering to clear data when the owner cannot be read", async () => {
    const saved: string[] = [];
    const broken = { load: async () => { throw new Error("db"); }, save: async (value: string) => { saved.push(value); } };
    expect(await notebookOwnerGate("same", broken)).toBe("blocked");
    expect(saved).toEqual([]);
  });

  it("lets the same user, a fresh install and a legacy owner sync", async () => {
    const store = (owner: string | null) => ({ load: async () => owner, save: async () => undefined });
    expect(await notebookOwnerGate("me", store("me"))).toBe("sync");
    expect(await notebookOwnerGate("me", store(null))).toBe("sync");
    expect(await notebookOwnerGate("me", store("other"))).toBe("switch");
  });

  it("does not clear any local data when both sign-out attempts fail", async () => {
    const events: string[] = [];
    await expect(signOutThenClear({
      signOut: async () => { events.push("remote"); throw new Error("offline"); },
      localSignOut: async () => { events.push("local"); throw new Error("storage"); },
      clearNotebook: async () => { events.push("notebook"); },
      clearPhotos: () => { events.push("photos"); },
    })).rejects.toThrow("storage");
    expect(events).toEqual(["remote", "local"]);
  });

  it("clears the notebook before photos after local-only sign-out succeeds", async () => {
    const events: string[] = [];
    await signOutThenClear({
      signOut: async () => { events.push("remote"); throw new Error("offline"); },
      localSignOut: async () => { events.push("local"); },
      clearNotebook: async () => { events.push("notebook"); },
      clearPhotos: () => { events.push("photos"); },
    });
    expect(events).toEqual(["remote", "local", "notebook", "photos"]);
  });

  it("keeps photos when clearing the notebook fails after sign-out", async () => {
    const events: string[] = [];
    await expect(signOutThenClear({
      signOut: async () => { events.push("remote"); },
      localSignOut: async () => { events.push("local"); },
      clearNotebook: async () => { events.push("notebook"); throw new Error("busy"); },
      clearPhotos: () => { events.push("photos"); },
    })).rejects.toThrow("busy");
    expect(events).toEqual(["remote", "notebook"]);
  });
});
