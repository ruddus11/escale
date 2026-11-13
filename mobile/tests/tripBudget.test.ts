import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { tripBudgetSummary } from "../src/data/tripBudget";

const make=()=>createTrip({title:"Trip",startDate:"2027-01-01",endDate:"2027-01-07",timeZone:"Asia/Seoul",baseCurrency:"KRW",members:[{name:"Me"}],coverColor:"ink"},{id:"budget-test",now:new Date("2026-10-01T00:00:00Z")});
describe("whole trip budget",()=>{
  it("does not invent a total from a daily allowance",()=>{
    const trip=make();trip.budget.dailyBudgetMinor=50000;
    expect(tripBudgetSummary(trip)).toEqual({total:undefined,spent:0,remaining:undefined});
  });
  it("uses all actual expenses, converts to base and preserves overspending",()=>{
    const trip=make();trip.budget.totalBudgetMinor=2000;
    trip.ledger.expenses=[{id:"e",title:"Lunch",amount:300,currency:"USD",rateToBase:"1400",category:"food",method:"card",occurredAt:"2027-01-02T00:00:00Z",paidBy:{kind:"member",memberId:trip.settings.ownerId},split:{kind:"even",memberIds:[trip.settings.ownerId]}}];
    expect(tripBudgetSummary(trip)).toEqual({total:2000,spent:4200,remaining:-2200});
  });
  it("keeps a zero budget distinct from an unset budget",()=>{
    const trip=make();trip.budget.totalBudgetMinor=0;
    expect(tripBudgetSummary(trip)).toEqual({total:0,spent:0,remaining:0});
  });
});
