import { describe, expect, it } from "vitest";
import { googleMapViewName, googleMapsReady, mapView, placeAccessState, type PlaceAccessState } from "../src/data/mapView";

describe("placeAccessState", () => {
  const base = { baseUrl: "https://api.example", credential: "", ready: true, canSignIn: true };

  it("treats a missing server address as a build problem even when signed in", () => {
    expect(placeAccessState({ ...base, baseUrl: "", credential: "token" })).toBe("unconfigured");
    expect(placeAccessState({ ...base, baseUrl: "", ready: false })).toBe("unconfigured");
  });

  it("is ready as soon as a token or access code exists", () => {
    expect(placeAccessState({ ...base, credential: "token", ready: false })).toBe("ready");
  });

  it("waits while sign-in state is still loading", () => {
    expect(placeAccessState({ ...base, ready: false })).toBe("loading");
  });

  it("allows guest lookup when the server is configured", () => {
    expect(placeAccessState(base)).toBe("ready");
    expect(placeAccessState({ ...base, canSignIn: false })).toBe("ready");
  });
});

describe("mapView", () => {
  const base = { points: 0, failed: 0, pending: 2, access: "ready" as PlaceAccessState, maps: true };

  it("shows cached points whatever the access state", () => {
    for (const access of ["ready", "loading", "signedOut", "unconfigured"] as const) {
      expect(mapView({ ...base, points: 1, access })).toBe("map");
    }
    expect(mapView({ ...base, points: 1, maps: false })).toBe("unavailable");
  });

  it("keeps the failure state with retry", () => {
    expect(mapView({ ...base, failed: 1, pending: 1, access: "signedOut" })).toBe("failed");
    expect(mapView({ ...base, failed: 1, maps: false })).toBe("failed");
  });

  it("draws nothing when there is nothing to find", () => {
    expect(mapView({ ...base, pending: 0, access: "signedOut" })).toBe("none");
    expect(mapView({ ...base, pending: 0, access: "unconfigured" })).toBe("none");
  });

  it("picks one placeholder per access state", () => {
    expect(mapView({ ...base, access: "loading" })).toBe("loading");
    expect(mapView({ ...base, access: "ready" })).toBe("loading");
    expect(mapView({ ...base, access: "signedOut" })).toBe("signIn");
    expect(mapView({ ...base, access: "unconfigured" })).toBe("unconfigured");
  });

  it("does not ask for sign-in when the build has no map module", () => {
    expect(mapView({ ...base, access: "signedOut", maps: false })).toBe("unavailable");
  });
});

describe("googleMapsReady", () => {
  const native = { nativeModule: true, googleView: true };

  it("never draws on Android without a configured key", () => {
    expect(googleMapsReady({ ...native, platform: "android", keys: { ios: true, android: false } })).toBe(false);
    expect(googleMapsReady({ ...native, platform: "android", keys: undefined })).toBe(false);
    expect(googleMapsReady({ ...native, platform: "android", keys: null })).toBe(false);
    expect(googleMapsReady({ ...native, platform: "android", keys: { android: "true" } })).toBe(false);
  });

  it("draws on Android once the build has a key and the native view", () => {
    expect(googleMapsReady({ ...native, platform: "android", keys: { android: true } })).toBe(true);
    expect(googleMapsReady({ platform: "android", nativeModule: false, googleView: true, keys: { android: true } })).toBe(false);
  });

  it("trusts the native Google view on iOS, which only exists when the key was built in", () => {
    expect(googleMapsReady({ ...native, platform: "ios", keys: undefined })).toBe(true);
    expect(googleMapsReady({ platform: "ios", nativeModule: true, googleView: false, keys: { ios: true } })).toBe(false);
  });

  it("looks for the view name each platform actually registers", () => {
    expect(googleMapViewName("android")).toBe("AIRMap");
    expect(googleMapViewName("ios")).toBe("AIRGoogleMap");
  });

  it("does not draw on other platforms", () => {
    expect(googleMapsReady({ ...native, platform: "web", keys: { ios: true, android: true } })).toBe(false);
  });
});

import { nativeMapProvider } from '../src/data/mapView';
it('uses keyless Apple maps on iOS and preserves Android key gating',()=>{
  expect(nativeMapProvider('ios',false)).toBe('apple');
  expect(nativeMapProvider('android',false)).toBeNull();
  expect(nativeMapProvider('android',true)).toBe('google');
});
