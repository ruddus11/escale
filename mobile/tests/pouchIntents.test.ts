import { describe, expect, it } from "vitest";
import { readPouch, type PouchContext } from "../src/data/pouchIntents";

const ctx = (local: PouchContext["localCurrency"] = "EUR", packing: PouchContext["packing"] = []): PouchContext => ({ localCurrency: local, packing });
const packing = [
  { id: "p1", title: "우산", done: false },
  { id: "p2", title: "보조배터리", done: false },
  { id: "p3", title: "charger", done: true },
];

describe("expenses", () => {
  it("reads an amount with a currency word", () => {
    expect(readPouch("커피 3.5유로", ctx("KRW"))).toEqual({ kind: "expense", title: "커피", amount: 350, currency: "EUR", category: "drink", method: "card" });
    expect(readPouch("택시 12000원 현금", ctx())).toMatchObject({ title: "택시", amount: 12000, currency: "KRW", category: "transport", method: "cash" });
    expect(readPouch("coffee 4 eur", ctx("KRW"))).toMatchObject({ title: "coffee", amount: 400, currency: "EUR" });
    expect(readPouch("3.5 euros for coffee", ctx("KRW"))).toMatchObject({ title: "coffee", amount: 350, currency: "EUR" });
    expect(readPouch("コーヒー ５００円", ctx("KRW"))).toMatchObject({ title: "コーヒー", amount: 500, currency: "JPY" });
  });

  it("reads Korean units", () => {
    expect(readPouch("점심 2만원", ctx())).toMatchObject({ title: "점심", amount: 20000, currency: "KRW", category: "food" });
    expect(readPouch("숙소 1만2천원", ctx())).toMatchObject({ amount: 12000, currency: "KRW" });
    expect(readPouch("저녁 3만5000원 카드로", ctx())).toMatchObject({ title: "저녁", amount: 35000, method: "card" });
  });

  it("uses the local currency when none is said", () => {
    expect(readPouch("커피 3.5", ctx("EUR"))).toMatchObject({ title: "커피", amount: 350, currency: "EUR" });
    expect(readPouch("버스 2.4 카드", ctx("EUR"))).toMatchObject({ title: "버스", amount: 240, currency: "EUR", method: "card" });
  });

  it("maps dollar signs to the local dollar", () => {
    expect(readPouch("lunch $12", ctx("AUD"))).toMatchObject({ amount: 1200, currency: "AUD" });
    expect(readPouch("lunch $12", ctx("EUR"))).toMatchObject({ amount: 1200, currency: "USD" });
    expect(readPouch("snack 20바트", ctx("KRW"))).toMatchObject({ amount: 2000, currency: "THB" });
  });

  it("keeps card names and strips spent words", () => {
    expect(readPouch("교통카드 충전 10000원", ctx())).toMatchObject({ title: "교통카드 충전", category: "transport", method: "card" });
    expect(readPouch("택시로 15유로 썼어", ctx("KRW"))).toMatchObject({ title: "택시", amount: 1500 });
  });

  it("does not read times, counts or dates as money", () => {
    expect(readPouch("내일 10시 기차", ctx())).toEqual({ kind: "ask", topic: "next" });
    expect(readPouch("체크인 15:00", ctx())).toEqual({ kind: "ask", topic: "stay" });
    expect(readPouch("10/14 기차", ctx())).toEqual({ kind: "ask", topic: "next" });
    expect(readPouch("3번 출구", ctx())).toEqual({ kind: "unknown" });
  });
});

describe("packing", () => {
  it("ticks and unticks items on the list", () => {
    expect(readPouch("우산 챙겼어", ctx("EUR", packing))).toEqual({ kind: "packed", itemId: "p1", done: true });
    expect(readPouch("보조배터리 안 챙겼어", ctx("EUR", packing))).toEqual({ kind: "packed", itemId: "p2", done: false });
    expect(readPouch("forgot the charger", ctx("EUR", packing))).toEqual({ kind: "packed", itemId: "p3", done: false });
  });

  it("adds new items", () => {
    expect(readPouch("선크림 챙겨야 해", ctx("EUR", packing))).toEqual({ kind: "packAdd", title: "선크림", done: false });
    expect(readPouch("짐에 어댑터 추가", ctx("EUR", packing))).toEqual({ kind: "packAdd", title: "어댑터", done: false });
    expect(readPouch("선글라스도 꼭 챙겨야 해", ctx())).toEqual({ kind: "packAdd", title: "선글라스", done: false });
    expect(readPouch("add sunscreen", ctx())).toEqual({ kind: "packAdd", title: "sunscreen", done: false });
    expect(readPouch("모자 챙겼어", ctx())).toEqual({ kind: "packAdd", title: "모자", done: true });
  });

  it("leaves other requests alone", () => {
    expect(readPouch("예약 추가", ctx())).toEqual({ kind: "ask", topic: "reservations" });
    expect(readPouch("우산 15유로 샀어", ctx("KRW", packing))).toMatchObject({ kind: "expense", title: "우산", amount: 1500, currency: "EUR" });
  });
});

describe("questions and notes", () => {
  it.each([
    "공항까지 몇시에 가야돼/", "공항 몇 시", "공항 몇시?!/~~", "공항 도착 몇 시까지", "공항 언제 가", "비행기 몇 시", "비행기 몇 시야", "몇 시에 출발해야 해",
    "귀국 비행기 언제", "출국 몇 시", "when should I leave for the airport", "flight time", "空港 何時",
  ])("reads airport question: %s", (phrase) => {
    expect(readPouch(phrase, ctx())).toEqual({ kind: "ask", topic: "airport" });
  });

  it.each([
    ["돈 얼마 남았어", "left"], ["얼마 남음?", "left"], ["예산 얼마 남았지", "left"], ["남은돈", "left"],
    ["체크인 언제야", "stay"], ["체크 인 몇시?", "stay"], ["숙소 몇 시부터 들어가", "stay"], ["체크아웃 몇시까지", "stay"],
    ["다음 이동 뭐야", "next"], ["다음에 뭐 타", "next"], ["이제 어디 가", "next"], ["기차 몇 시", "next"],
    ["내일 뭐 해", "tomorrow"], ["내일 일정 뭐야", "tomorrow"], ["내일 첫 일정 몇 시", "tomorrow"],
  ] as const)("reads casual question: %s", (phrase, topic) => {
    expect(readPouch(phrase, ctx())).toEqual({ kind: "ask", topic });
  });

  it.each([
    ["택시 12유로", "택시", 1200, "EUR"], ["택시 12유로/", "택시", 1200, "EUR"],
    ["커피 3.5유로~", "커피", 350, "EUR"], ["라멘 1200엔 현금", "라멘", 1200, "JPY"],
    ["점심 2만원 썼어?", "점심", 20000, "KRW"], ["공항 리무진 2000엔", "공항 리무진", 2000, "JPY"],
    ["공항까지 택시 50유로 썼어", "공항까지 택시", 5000, "EUR"],
  ] as const)("keeps expense priority: %s", (phrase, title, amount, currency) => {
    expect(readPouch(phrase, ctx("KRW"))).toMatchObject({ kind: "expense", title, amount, currency });
  });

  it.each([
    ["비행기 RF318?", { kind: "ask", topic: "next" }], ["호텔 1205?", { kind: "ask", topic: "stay" }], ["버스 10?", { kind: "ask", topic: "next" }],
    ["게이트 12?", { kind: "unknown" }], ["터미널 2?", { kind: "unknown" }], ["객실 1205?", { kind: "unknown" }],
    ["10/", { kind: "unknown" }], ["12.", { kind: "unknown" }], ["12,", { kind: "unknown" }], ["커피 3.5!", { kind: "unknown" }],
  ] as const)("does not read a bare number before punctuation as money: %s", (phrase, intent) => {
    expect(readPouch(phrase, ctx("JPY"))).toEqual(intent);
  });

  it.each([
    ["호텔 1205엔?", 1205, "JPY"], ["택시 12유로?", 1200, "EUR"], ["lunch $12?", 1200, "USD"],
  ] as const)("keeps an expense when the unit is said: %s", (phrase, amount, currency) => {
    expect(readPouch(phrase, ctx("KRW"))).toMatchObject({ kind: "expense", amount, currency });
  });

  it.each([
    "기차 몇 시에 출발해야 해", "버스 몇시에 출발해야 돼", "열차 몇 시에 출발해야 해", "KTX 몇 시에 출발해야 해", "what time should the train depart", "when does the bus depart",
    "공항버스 몇 시", "공항 가는 버스 몇 시", "공항 가는 기차 언제", "airport bus time", "空港バス 何時", "공항철도 시간", "공항철도", "공항 리무진 몇 시",
  ])("keeps ground transport as next: %s", (phrase) => {
    expect(readPouch(phrase, ctx())).toEqual({ kind: "ask", topic: "next" });
  });

  it("still records a priced airport ride", () => {
    expect(readPouch("공항버스 2000엔", ctx("KRW"))).toMatchObject({ kind: "expense", amount: 2000, currency: "JPY" });
  });

  it("answers the chips' questions", () => {
    expect(readPouch("남은 돈", ctx())).toEqual({ kind: "ask", topic: "left" });
    expect(readPouch("오늘 숙소 체크인 몇 시야?", ctx())).toEqual({ kind: "ask", topic: "stay" });
    expect(readPouch("다음 기차 몇 시", ctx())).toEqual({ kind: "ask", topic: "next" });
    expect(readPouch("내일 첫 일정", ctx())).toEqual({ kind: "ask", topic: "tomorrow" });
    expect(readPouch("짐 목록", ctx())).toEqual({ kind: "ask", topic: "pack" });
    expect(readPouch("오늘 기록", ctx())).toEqual({ kind: "ask", topic: "today" });
  });

  it("saves a note after a colon", () => {
    expect(readPouch("기록: 바다가 예뻤다", ctx())).toEqual({ kind: "journal", text: "바다가 예뻤다" });
    expect(readPouch("note: 3 coffees today", ctx())).toEqual({ kind: "journal", text: "3 coffees today" });
  });

  it.each([
    ["기록: 정말?", "정말?"], ["일기: 와!!!", "와!!!"], ["메모: 다음에 또 올까...", "다음에 또 올까..."],
  ])("keeps a note's punctuation: %s", (phrase, text) => {
    expect(readPouch(phrase, ctx())).toEqual({ kind: "journal", text });
  });

  it("does not save punctuation alone as anything", () => {
    expect(readPouch("?!", ctx())).toEqual({ kind: "unknown" });
  });

  it("does not guess at other words", () => {
    expect(readPouch("안녕", ctx())).toEqual({ kind: "unknown" });
    expect(readPouch("   ", ctx())).toEqual({ kind: "unknown" });
  });
});
