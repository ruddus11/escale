import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { isBudgetSettings } from "../../src/repositories/workspaceSchema";
import { DEFAULT_SHARES, dailyBudgetOf, envelopeLimits, envelopesFor, guessCategory, knownRate, moveShare, sharesOf } from "../src/data/budgetPlan";

const trip = createTrip({title:"리스본",startDate:"2026-10-13",endDate:"2026-10-16",timeZone:"Europe/Lisbon",baseCurrency:"KRW",members:[{name:"나"}],coverColor:"ink"},{id:"trip",now:new Date("2026-10-01T00:00:00Z")});
const me = trip.settings.ownerId;
const expense = (id: string, category: "food"|"drink"|"transport", amount: number, occurredAt: string, currency: "KRW"|"EUR" = "KRW", rateToBase = "1") => ({ id, title:id, amount, currency, rateToBase, category, method:"card" as const, occurredAt, paidBy:{kind:"member" as const,memberId:me}, split:{kind:"even" as const,memberIds:[me]} });

describe("daily budget", () => {
  it("prefers the daily amount and otherwise splits the total over trip days", () => {
    expect(dailyBudgetOf(trip)).toBeUndefined();
    expect(dailyBudgetOf({...trip,budget:{...trip.budget,totalBudgetMinor:600_001}})).toBe(150_000);
    expect(dailyBudgetOf({...trip,budget:{...trip.budget,totalBudgetMinor:600_000,dailyBudgetMinor:200_000}})).toBe(200_000);
  });

  it("splits a daily budget into envelopes that add up exactly", () => {
    const limits = envelopeLimits(150_001, DEFAULT_SHARES);
    expect(Object.values(limits).reduce((a,b)=>a+b,0)).toBe(150_001);
    expect(limits.food).toBe(52_501);
  });
});

describe("moving shares", () => {
  it("keeps the total at 100 by trading with 기타 first", () => {
    const up = moveShare(DEFAULT_SHARES, "food", 5);
    expect(up).toMatchObject({food:40, other:5});
    const empty = moveShare({...DEFAULT_SHARES, food:45, other:0}, "drink", 5);
    expect(empty.drink).toBe(15);
    expect(Object.values(empty).reduce((a,b)=>a+b,0)).toBe(100);
    expect(moveShare({...DEFAULT_SHARES, drink:0, other:20}, "drink", -5)).toMatchObject({drink:0, other:20});
  });
});

describe("envelopes for a day", () => {
  it("sums each category in base currency on the trip's local date", () => {
    const t = {...trip, budget:{...trip.budget,dailyBudgetMinor:100_000}, ledger:{...trip.ledger, expenses:[
      expense("lunch","food",2450,"2026-10-14T12:00:00Z","EUR","1480"),
      expense("coffee","drink",5000,"2026-10-14T09:00:00Z"),
      expense("late","transport",9000,"2026-10-14T23:30:00Z"),
    ]}};
    const day = envelopesFor(t,"2026-10-14");
    expect(day.envelopes.find(e=>e.key==="food")).toMatchObject({spent:36_260,limit:35_000});
    expect(day.spent).toBe(41_260);
    expect(envelopesFor(t,"2026-10-15").envelopes.find(e=>e.key==="transport")?.spent).toBe(9000);
  });

  it("falls back to default shares and validates saved ones", () => {
    expect(sharesOf(trip)).toEqual(DEFAULT_SHARES);
    expect(isBudgetSettings({...trip.budget,dailyBudgetMinor:1000,categoryShares:DEFAULT_SHARES})).toBe(true);
    expect(isBudgetSettings({...trip.budget,categoryShares:{...DEFAULT_SHARES,food:36}})).toBe(false);
    expect(isBudgetSettings({...trip.budget,categoryShares:{...DEFAULT_SHARES,food:-5,other:50}})).toBe(false);
  });
});

describe("guessing a category from the memo", () => {
  it("works with words used anywhere and leaves unknown memos alone", () => {
    expect(guessCategory("Time Out Market")).toBe("food");
    expect(guessCategory("트램 28번")).toBe("transport");
    expect(guessCategory("Uber to hotel")).toBe("transport");
    expect(guessCategory("미술관 입장권")).toBe("admission");
    expect(guessCategory("starbucks coffee")).toBe("drink");
    expect(guessCategory("면세점")).toBe("shopping");
    expect(guessCategory("파스텔 드 나타")).toBeUndefined();
    expect(guessCategory("")).toBeUndefined();
  });
});

describe("known rate", () => {
  it("reuses the latest rate for a currency and needs one the first time", () => {
    const t = {...trip, ledger:{...trip.ledger, expenses:[
      expense("old","food",1000,"2026-10-13T12:00:00Z","EUR","1450"),
      expense("new","drink",350,"2026-10-14T09:00:00Z","EUR","1480"),
    ]}};
    expect(knownRate(t,"EUR")).toBe("1480");
    expect(knownRate(t,"KRW")).toBe("1");
    expect(knownRate(t,"JPY")).toBeUndefined();
  });
});
