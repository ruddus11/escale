import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ITEMS,
  GUEST,
  accountConsentValid,
  agreeAccount,
  agreeFeature,
  featureConsentValid,
  forgetAccount,
  legalLang,
  markSent,
  parseConsent,
  sendConsents,
  unsentConsents,
  withdrawFeature,
  type ConsentRow,
  type ConsentState,
} from "../src/data/consent";
import { AI_CONSENT_VERSION, LEGAL_VERSION } from "../../src/domain/legal";

const now = new Date("2026-10-15T01:02:03.000Z");
const later = new Date("2026-10-16T05:00:00.000Z");

describe("account consent", () => {
  it("counts only when every required item of the current version is agreed", () => {
    expect(accountConsentValid({})).toBe(false);
    expect(accountConsentValid(agreeAccount({}, ["terms", "collection", "overseas"], now))).toBe(false);
    const agreed = agreeAccount({}, ACCOUNT_ITEMS, now);
    expect(accountConsentValid(agreed)).toBe(true);
    expect(accountConsentValid({ account: { version: "2026-10-28", at: now.toISOString(), items: ACCOUNT_ITEMS } })).toBe(false);
    expect(agreed.account).toEqual({ version: LEGAL_VERSION, at: "2026-10-15T01:02:03.000Z", items: ACCOUNT_ITEMS });
    expect(accountConsentValid(agreed, "2027-01-01")).toBe(false);
  });

  it("forgets every consent on sign-out so the next person is asked again", () => {
    const state = agreeFeature(agreeAccount({}, ACCOUNT_ITEMS, now), "recommend", "user-a", now);
    const after = forgetAccount(state);
    expect(accountConsentValid(after)).toBe(false);
    expect(featureConsentValid(after, "recommend", "user-a")).toBe(false);
    expect(after).toEqual({});
  });

  it("asks an existing user once for the new legal version and queues one current record", () => {
    const old = parseConsent(JSON.stringify({ account: { version: "2026-10-28", at: now.toISOString(), items: ACCOUNT_ITEMS, sentFor: "user-a" } }));
    expect(accountConsentValid(old)).toBe(false);
    expect(unsentConsents(old, "user-a")).toEqual([]);

    const renewed = agreeAccount(old, ACCOUNT_ITEMS, later);
    expect(accountConsentValid(renewed)).toBe(true);
    const rows = unsentConsents(renewed, "user-a");
    expect(rows).toEqual([{ user_id: "user-a", kind: "account", event: "agree", version: LEGAL_VERSION, items: ACCOUNT_ITEMS, occurred_at: later.toISOString() }]);
    const saved = parseConsent(JSON.stringify(markSent(renewed, rows)));
    expect(accountConsentValid(saved)).toBe(true);
    expect(unsentConsents(saved, "user-a")).toEqual([]);
  });
});

describe("AI feature consent", () => {
  it("covers only the feature that was agreed", () => {
    const state = agreeFeature({}, "recommend", "user-a", now);
    expect(state.features?.recommend).toEqual({ version: AI_CONSENT_VERSION, at: now.toISOString(), owner: "user-a" });
    expect(featureConsentValid(state, "recommend", "user-a")).toBe(true);
    expect(featureConsentValid(state, "booking", "user-a")).toBe(false);
    expect(featureConsentValid(state, "pouch", "user-a")).toBe(false);
  });

  it("belongs to the person who agreed", () => {
    const state = agreeFeature({}, "booking", "user-a", now);
    expect(featureConsentValid(state, "booking", "user-b")).toBe(false);
    expect(featureConsentValid(state, "booking", GUEST)).toBe(false);
    const guest = agreeFeature({}, "booking", GUEST, now);
    expect(featureConsentValid(guest, "booking", "user-a")).toBe(false);
  });

  it("asks again when the consent text changes or after withdrawal", () => {
    const old = parseConsent(JSON.stringify({ features: { recommend: { version: "2026-10-16", at: now.toISOString(), owner: "user-a" } } }));
    expect(featureConsentValid(old, "recommend", "user-a")).toBe(false);
    const state = agreeFeature({}, "pouch", "user-a", now);
    expect(featureConsentValid(state, "pouch", "user-a", "2099-01-01")).toBe(false);
    const withdrawn = withdrawFeature(state, "pouch", later);
    expect(featureConsentValid(withdrawn, "pouch", "user-a")).toBe(false);
  });
});

describe("parseConsent", () => {
  it("round-trips what the app saves", () => {
    const sent = markSent(agreeFeature(agreeAccount({}, ACCOUNT_ITEMS, now), "recommend", "user-a", now), [
      { user_id: "user-a", kind: "recommend", event: "agree", version: AI_CONSENT_VERSION, items: [], occurred_at: now.toISOString() },
    ]);
    const state = withdrawFeature(sent, "recommend", later);
    expect(state.withdrawals).toHaveLength(1);
    expect(parseConsent(JSON.stringify(state))).toEqual(state);
  });

  it("does not carry the old all-in-one AI consent over to a feature", () => {
    const old = { ai: { version: "2026-10-15", at: now.toISOString() } };
    expect(parseConsent(JSON.stringify(old))).toEqual({});
  });

  it("drops broken or unknown values", () => {
    expect(parseConsent(null)).toEqual({});
    expect(parseConsent("{nope")).toEqual({});
    expect(parseConsent(JSON.stringify({ account: { version: "x", at: "not a date", items: [] } }))).toEqual({});
    expect(parseConsent(JSON.stringify({ account: { version: "v", at: now.toISOString(), items: ["terms", "marketing"] } })).account?.items).toEqual(["terms"]);
    // 주인이 없는 기능 동의와 모르는 기능은 버린다.
    expect(parseConsent(JSON.stringify({ features: { recommend: { version: "v", at: now.toISOString() }, ads: { version: "v", at: now.toISOString(), owner: "a" } } }))).toEqual({});
  });
});

describe("sending consent records", () => {
  const state: ConsentState = agreeFeature(agreeFeature(agreeAccount({}, ACCOUNT_ITEMS, now), "recommend", "user-1", now), "booking", GUEST, now);

  it("sends the account consent and only the features this account agreed to", async () => {
    const sent: ConsentRow[] = [];
    const rows = await sendConsents(async (batch) => (sent.push(...batch), { error: null }), unsentConsents(state, "user-1"));
    expect(sent.map((r) => [r.kind, r.event])).toEqual([
      ["account", "agree"],
      ["recommend", "agree"],
    ]);
    expect(sent[0]).toEqual({ user_id: "user-1", kind: "account", event: "agree", version: LEGAL_VERSION, items: ACCOUNT_ITEMS, occurred_at: now.toISOString() });
    const after = markSent(state, rows);
    expect(unsentConsents(after, "user-1")).toEqual([]);
    // 다른 계정에는 기능 동의를 넘기지 않는다. 로그인 전에 받은 계정 동의만 그 계정으로 올린다.
    expect(unsentConsents(after, "user-2").map((r) => r.kind)).toEqual(["account"]);
  });

  it("records a withdrawal of a consent that reached the server, then forgets it", async () => {
    const sent = markSent(state, await sendConsents(async () => ({ error: null }), unsentConsents(state, "user-1")));
    const withdrawn = withdrawFeature(sent, "recommend", later);
    const rows = unsentConsents(withdrawn, "user-1");
    expect(rows).toEqual([{ user_id: "user-1", kind: "recommend", event: "withdraw", version: AI_CONSENT_VERSION, items: [], occurred_at: later.toISOString() }]);
    const after = markSent(withdrawn, await sendConsents(async () => ({ error: null }), rows));
    expect(after.withdrawals).toBeUndefined();
    expect(unsentConsents(after, "user-1")).toEqual([]);
  });

  it("does not record a withdrawal for a consent the server never got", () => {
    const withdrawn = withdrawFeature(state, "recommend", later);
    expect(withdrawn.withdrawals).toBeUndefined();
    expect(unsentConsents(withdrawn, "user-1").map((r) => r.kind)).toEqual(["account"]);
  });

  it("keeps a record for later when the server fails, and treats duplicates as sent", async () => {
    const rows = await sendConsents(async ([row]) => ({ error: row.kind === "account" ? { code: "23505" } : { code: "PGRST" } }), unsentConsents(state, "user-1"));
    expect(unsentConsents(markSent(state, rows), "user-1").map((r) => r.kind)).toEqual(["recommend"]);
    expect(await sendConsents(async () => Promise.reject(new Error("offline")), unsentConsents(state, "user-1"))).toEqual([]);
  });

  it("never sends an outdated agreement", () => {
    const old: ConsentState = {
      account: { version: "2020-01-01", at: now.toISOString(), items: ACCOUNT_ITEMS },
      features: { pouch: { version: "2020-01-01", at: now.toISOString(), owner: "user-1" } },
    };
    expect(unsentConsents(old, "user-1")).toEqual([]);
  });
});

describe("legalLang", () => {
  it("maps app languages to document languages", () => {
    expect(legalLang("ko")).toBe("ko");
    expect(legalLang("en-GB")).toBe("en");
    expect(legalLang("en-US")).toBe("en");
    expect(legalLang("ja")).toBe("ja");
  });
});
