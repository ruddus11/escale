import { AI_CONSENT_VERSION, AI_FEATURES, LEGAL_VERSION, type AiFeature, type LegalLang } from "../../../src/domain/legal";
import type { Lang } from "../i18n/strings";

// 동의 기록. 로그인 전에 받은 계정 동의는 기기에 남기고, 로그인하면 그 계정의 서버 기록으로 올린다.
// 문서 판(LEGAL_VERSION, AI_CONSENT_VERSION)이 바뀌면 이전 동의는 효력이 없고 다시 묻는다.
// AI·장소 기능은 기능마다 따로, 동의한 사람(계정 또는 게스트)에게만 효력이 있다.

export type AccountItem = "age14" | "terms" | "collection" | "overseas";
export const ACCOUNT_ITEMS: AccountItem[] = ["age14", "terms", "collection", "overseas"];

/** 로그인하지 않은 사람. 시험 빌드에서 접근 코드로 기능을 쓸 때의 동의 주인이다. */
export const GUEST = "guest";

export interface ConsentRecord {
  version: string;
  /** 동의한 시각. ISO 8601(UTC). */
  at: string;
  /** 이 기록을 서버에 올린 계정 id. 아직 안 올렸으면 없다. */
  sentFor?: string;
}

export interface FeatureConsent extends ConsentRecord {
  /** 동의한 사람. 로그인했으면 계정 id, 아니면 GUEST. 다른 사람에게 넘기지 않는다. */
  owner: string;
}

/** 서버에 이미 올린 기능 동의를 철회한 기록. 서버에 올리면 지운다. */
export interface Withdrawal {
  feature: AiFeature;
  version: string;
  at: string;
  owner: string;
}

export interface ConsentState {
  account?: ConsentRecord & { items: AccountItem[] };
  features?: Partial<Record<AiFeature, FeatureConsent>>;
  withdrawals?: Withdrawal[];
}

const MAX_WITHDRAWALS = 20;

export function parseConsent(raw: string | null): ConsentState {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    const state: ConsentState = {};
    if (isRecord(value?.account) && Array.isArray(value.account.items))
      state.account = { ...pickRecord(value.account), items: ACCOUNT_ITEMS.filter((item) => value.account.items.includes(item)) };
    // 예전의 통합 AI 동의(ai)는 옮기지 않는다. 기능별 동의서로 다시 묻는다.
    const features: Partial<Record<AiFeature, FeatureConsent>> = {};
    for (const feature of AI_FEATURES) {
      const v = value?.features?.[feature];
      if (isRecord(v) && isOwner((v as FeatureConsent).owner)) features[feature] = { ...pickRecord(v), owner: (v as FeatureConsent).owner };
    }
    if (Object.keys(features).length) state.features = features;
    if (Array.isArray(value?.withdrawals)) {
      const withdrawals = (value.withdrawals as Withdrawal[])
        .filter((w) => !!w && AI_FEATURES.includes(w.feature) && typeof w.version === "string" && typeof w.at === "string" && !Number.isNaN(Date.parse(w.at)) && isOwner(w.owner))
        .slice(-MAX_WITHDRAWALS)
        .map((w) => ({ feature: w.feature, version: w.version, at: w.at, owner: w.owner }));
      if (withdrawals.length) state.withdrawals = withdrawals;
    }
    return state;
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is ConsentRecord {
  const v = value as ConsentRecord;
  return !!v && typeof v.version === "string" && typeof v.at === "string" && !Number.isNaN(Date.parse(v.at));
}

function isOwner(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function pickRecord(value: ConsentRecord): ConsentRecord {
  return { version: value.version, at: value.at, ...(typeof value.sentFor === "string" ? { sentFor: value.sentFor } : {}) };
}

/** 지금 판의 필수 항목에 모두 동의했는지. */
export function accountConsentValid(state: ConsentState, version = LEGAL_VERSION): boolean {
  return state.account?.version === version && ACCOUNT_ITEMS.every((item) => state.account!.items.includes(item));
}

/** 이 사람이 이 기능의 지금 판 동의서에 동의했는지. */
export function featureConsentValid(state: ConsentState, feature: AiFeature, owner: string, version = AI_CONSENT_VERSION): boolean {
  const record = state.features?.[feature];
  return !!record && record.version === version && record.owner === owner;
}

export function agreeAccount(state: ConsentState, items: AccountItem[], now: Date, version = LEGAL_VERSION): ConsentState {
  return { ...state, account: { version, at: now.toISOString(), items: ACCOUNT_ITEMS.filter((item) => items.includes(item)) } };
}

export function agreeFeature(state: ConsentState, feature: AiFeature, owner: string, now: Date, version = AI_CONSENT_VERSION): ConsentState {
  return { ...state, features: { ...state.features, [feature]: { version, at: now.toISOString(), owner } } };
}

/** 기능 동의를 철회한다. 서버에 이미 올린 동의면 철회 기록을 남겨 서버에도 올린다. */
export function withdrawFeature(state: ConsentState, feature: AiFeature, now: Date): ConsentState {
  const record = state.features?.[feature];
  if (!record) return state;
  const { [feature]: _record, ...rest } = state.features!;
  const { features: _features, withdrawals: _withdrawals, ...others } = state;
  const reached = record.owner !== GUEST && record.sentFor === record.owner;
  const withdrawals = reached
    ? [...(state.withdrawals ?? []), { feature, version: record.version, at: now.toISOString(), owner: record.owner }].slice(-MAX_WITHDRAWALS)
    : state.withdrawals;
  return {
    ...others,
    ...(Object.keys(rest).length ? { features: rest } : {}),
    ...(withdrawals?.length ? { withdrawals } : {}),
  };
}

/** 로그아웃·계정 삭제 뒤에는 이 기기의 동의 기록(계정 동의, 기능 동의)을 모두 지운다. 다음 사람에게 넘기지 않는다. */
export function forgetAccount(_state: ConsentState): ConsentState {
  return {};
}

/** 서버 consents 표에 넣을 행. 동의와 철회를 고치지 않고 쌓는다. */
export interface ConsentRow {
  user_id: string;
  kind: "account" | AiFeature;
  event: "agree" | "withdraw";
  version: string;
  items: string[];
  occurred_at: string;
}

/** 이 계정으로 아직 올리지 않은 동의와 철회. 기능 동의는 이 계정이 한 것만 올린다. */
export function unsentConsents(state: ConsentState, userId: string): ConsentRow[] {
  const rows: ConsentRow[] = [];
  if (state.account && accountConsentValid(state) && state.account.sentFor !== userId)
    rows.push({ user_id: userId, kind: "account", event: "agree", version: state.account.version, items: state.account.items, occurred_at: state.account.at });
  for (const feature of AI_FEATURES) {
    const record = state.features?.[feature];
    if (record && featureConsentValid(state, feature, userId) && record.sentFor !== userId)
      rows.push({ user_id: userId, kind: feature, event: "agree", version: record.version, items: [], occurred_at: record.at });
  }
  for (const w of state.withdrawals ?? [])
    if (w.owner === userId) rows.push({ user_id: userId, kind: w.feature, event: "withdraw", version: w.version, items: [], occurred_at: w.at });
  return rows;
}

/** 서버에 올린 행을 기록에 표시한다. 올리는 동안 기록이 바뀌었으면 같은 기록에만 표시한다. */
export function markSent(state: ConsentState, rows: ConsentRow[]): ConsentState {
  if (!rows.length) return state;
  const sent = (kind: ConsentRow["kind"], event: ConsentRow["event"], version: string, at: string) =>
    rows.find((row) => row.kind === kind && row.event === event && row.version === version && row.occurred_at === at)?.user_id;
  const next: ConsentState = { ...state };
  const accountFor = state.account && sent("account", "agree", state.account.version, state.account.at);
  if (state.account && accountFor) next.account = { ...state.account, sentFor: accountFor };
  if (state.features) {
    const features = { ...state.features };
    for (const feature of AI_FEATURES) {
      const record = features[feature];
      const owner = record && sent(feature, "agree", record.version, record.at);
      if (record && owner) features[feature] = { ...record, sentFor: owner };
    }
    next.features = features;
  }
  if (state.withdrawals) {
    const left = state.withdrawals.filter((w) => !rows.some((row) => row.event === "withdraw" && row.kind === w.feature && row.version === w.version && row.occurred_at === w.at && row.user_id === w.owner));
    if (left.length) next.withdrawals = left;
    else delete next.withdrawals;
  }
  return next;
}

type Insert = (rows: ConsentRow[]) => PromiseLike<{ error: { code?: string } | null }>;

/** 행을 서버에 올리고 올라간 행을 돌려준다. 실패한 것은 다음 로그인·실행 때 다시 올린다. */
export async function sendConsents(insert: Insert, rows: ConsentRow[]): Promise<ConsentRow[]> {
  const sent: ConsentRow[] = [];
  // 한 행이 중복이어도 다른 행은 올라가도록 하나씩 넣는다.
  for (const row of rows) {
    try {
      const { error } = await insert([row]);
      // 23505: 같은 기록이 이미 있다(올린 뒤 기기에 표시하기 전에 앱이 꺼진 경우). 올린 것으로 본다.
      if (!error || error.code === "23505") sent.push(row);
    } catch {
      // 오프라인이면 다음에 다시 올린다.
    }
  }
  return sent;
}

/** 앱 언어 → 법률 문서 언어. 영국·미국 영어는 같은 문서를 본다. */
export function legalLang(lang: Lang): LegalLang {
  return lang === "ko" ? "ko" : lang === "ja" ? "ja" : "en";
}
