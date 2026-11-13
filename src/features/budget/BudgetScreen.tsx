import { SUPPORTED_CURRENCIES, isCurrencyCode, parseMoney, moneyInput, formatMoney } from "../../domain/money/currency";
import type { CurrencyCode } from "../../domain/money/types";
import { validateExpense } from "../../domain/money/validateLedger";
import { toMoneyLedger } from "../../domain/workspace/tripLedger";
import { fromLocal, zonedDate } from "../../domain/time/zoned";
import { useEffect, useState, type FormEvent } from "react";
import { calculateBudget } from "../../domain/budget/calculateBudget";
import { createOwnerExpense } from "../../domain/workspace/tripLedger";
import type {
  ExpenseCategory,
  TripWorkspace,
} from "../../domain/workspace/types";

interface BudgetScreenProps {
  workspace: TripWorkspace;
  now: Date;
  onChange: (workspace: TripWorkspace) => void;
  idFactory?: () => string;
}



const maximumBudgetMinor = 100_000_000;
const maximumMealBudgetMinor = 10_000_000;
const categoryLabels: Record<ExpenseCategory, string> = {
  transport: "교통",
  food: "식사",
  drink: "음료",
  admission: "입장료",
  shopping: "쇼핑",
  other: "기타",
};

export function BudgetScreen({
  workspace,
  now,
  onChange,
  idFactory = () => crypto.randomUUID(),
}: BudgetScreenProps) {
  const summary = calculateBudget(workspace);
  const baseCurrency = workspace.settings.baseCurrency;
  const [expenseCurrency, setExpenseCurrency] = useState<CurrencyCode>(workspace.settings.localCurrency);
  const [rate, setRate] = useState("");
  const quickAmounts = expenseCurrency === "KRW" ? [1000, 5000, 10000]
    : expenseCurrency === "JPY" ? [300, 500, 1000] : [10, 20, 50];
  const moneyFormatter = { format: (amount: number) => formatMoney(amount, baseCurrency) };
  const amountInput = (amount: number | undefined) => moneyInput(amount, baseCurrency);
  const parse = (value: string) => parseMoney(value, baseCurrency);
  const currencyLabel = baseCurrency === "JPY" ? "엔" : baseCurrency;
  const expenseLabel = expenseCurrency === "JPY" ? "엔" : expenseCurrency;
  const [totalBudget, setTotalBudget] = useState(
    amountInput(workspace.budget.totalBudgetMinor),
  );
  const [reserve, setReserve] = useState(
    amountInput(workspace.budget.emergencyReserveMinor),
  );
  const [mealBudget, setMealBudget] = useState(
    amountInput(workspace.budget.mealBudgetPerPersonMinor),
  );
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] =
    useState<ExpenseCategory>("food");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseDate, setExpenseDate] = useState(() =>
    toTripDate(now, workspace.schedule.startDate, workspace.schedule.endDate, workspace.settings.timeZone),
  );
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setTotalBudget(amountInput(workspace.budget.totalBudgetMinor));
    setReserve(amountInput(workspace.budget.emergencyReserveMinor));
    setMealBudget(amountInput(workspace.budget.mealBudgetPerPersonMinor));
  }, [
    workspace.budget.emergencyReserveMinor,
    workspace.budget.mealBudgetPerPersonMinor,
    workspace.budget.totalBudgetMinor,
  ]);

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const total = parse(totalBudget);
    const emergency = parse(reserve);
    const meal = parse(mealBudget);
    if (
      (totalBudget.trim() !== "" && (total === undefined || total > maximumBudgetMinor)) ||
      (emergency === undefined || emergency > maximumBudgetMinor) ||
      (mealBudget.trim() !== "" && (meal === undefined || meal > maximumMealBudgetMinor))
    ) {
      setBudgetError("예산을 0 이상, 해당 통화의 소수 자릿수에 맞게 입력해주세요.");
      return;
    }

    onChange({
      ...workspace,
      budget: {
        ...(totalBudget.trim().length === 0
          ? {}
          : { totalBudgetMinor: total! }),
        emergencyReserveMinor: emergency,
        ...(mealBudget.trim().length === 0
          ? {}
          : { mealBudgetPerPersonMinor: meal! }),
      },
    });
    setBudgetError(null);
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoney(expenseAmount, expenseCurrency);
    if (amount === undefined || amount < 1 || amount > maximumBudgetMinor) {
      setExpenseError("지출 금액을 0보다 크게, 해당 통화의 소수 자릿수에 맞게 입력해주세요.");
      return;
    }
    if (
      expenseDate < workspace.schedule.startDate ||
      expenseDate > workspace.schedule.endDate
    ) {
      setExpenseError("여행 기간 안의 날짜를 선택해주세요.");
      return;
    }

    const note = expenseNote.trim();
    let occurredAt: string;
    try { occurredAt = fromLocal(expenseDate, "12:00", workspace.settings.timeZone); }
    catch { setExpenseError("유효한 현지 날짜를 선택해주세요."); return; }
    const entry = {
      ...createOwnerExpense(workspace.settings, { id: idFactory(), amount, category: expenseCategory, occurredAt, ...(note ? { note } : {}) }),
      currency: expenseCurrency,
      rateToBase: expenseCurrency === baseCurrency ? "1" : rate,
    };
    if (validateExpense(entry, toMoneyLedger(workspace)).length > 0) { setExpenseError("금액과 환율을 확인해주세요. 다른 통화는 입력 당시 환율이 필요해요."); return; }
    onChange({
      ...workspace,
      ledger: {
        ...workspace.ledger,
        expenses: [
          ...workspace.ledger.expenses,
          entry,
        ],
      },
    });
    setExpenseAmount("");
    setExpenseNote("");
    setExpenseError(null);
  }

  function deleteExpense(expenseId: string) {
    onChange({
      ...workspace,
      ledger: {
        ...workspace.ledger,
        expenses: workspace.ledger.expenses.filter((expense) => expense.id !== expenseId),
      },
    });
    setConfirmDeleteId(null);
  }

  // 모든 통화의 원금 기록을 보여 주고 합계만 기준 통화로 환산한다.
  const orderedExpenses = [...workspace.ledger.expenses]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

  return (
    <div className="budget-screen">
      <header className="screen-header">
        <div>
          <p>1인 기준 · {baseCurrency}</p>
          <h1>예산</h1>
        </div>
      </header>

      <main>
        {workspace.legacyYenBudget === undefined ? null : (
          <section className="budget-card" aria-labelledby="legacy-budget-title">
            <h2 id="legacy-budget-title">이전 엔화 예산</h2>
            <p>원래 금액을 보관했습니다. {baseCurrency} 예산은 아래에서 새로 입력해주세요.</p>
            <dl>
              <dt>총예산</dt>
              <dd>{workspace.legacyYenBudget.totalBudgetMinor === undefined ? "미설정" : formatMoney(workspace.legacyYenBudget.totalBudgetMinor, "JPY")}</dd>
              <dt>비상금</dt>
              <dd>{formatMoney(workspace.legacyYenBudget.emergencyReserveMinor, "JPY")}</dd>
              <dt>한 끼 예산</dt>
              <dd>{workspace.legacyYenBudget.mealBudgetPerPersonMinor === undefined ? "미설정" : formatMoney(workspace.legacyYenBudget.mealBudgetPerPersonMinor, "JPY")}</dd>
            </dl>
          </section>
        )}
        <section className="budget-summary" aria-labelledby="budget-summary-title">
          <span>지금 쓸 수 있는 금액</span>
          {summary.availableMinor === undefined ? (
            <h2 id="budget-summary-title">총예산을 설정해주세요</h2>
          ) : summary.availableMinor >= 0 ? (
            <>
              <h2 id="budget-summary-title">
                {moneyFormatter.format(summary.availableMinor)}
              </h2>
              <p>비상금 제외 사용 가능</p>
            </>
          ) : (
            <>
              <h2 id="budget-summary-title" className="is-over">
                {moneyFormatter.format(Math.abs(summary.availableMinor))} 초과
              </h2>
              <p>총예산과 비상금을 다시 확인해주세요.</p>
            </>
          )}
          <dl>
            <div>
              <dt>실제 지출</dt>
              <dd>{moneyFormatter.format(summary.spentMinor)}</dd>
            </div>
            <div>
              <dt>비상금</dt>
              <dd>{moneyFormatter.format(summary.emergencyReserveMinor)}</dd>
            </div>
          </dl>
        </section>

        <section className="budget-card" aria-labelledby="budget-settings-title">
          <h2 id="budget-settings-title">예산 설정</h2>
          <form onSubmit={saveBudget}>
            {budgetError === null ? null : <p role="alert">{budgetError}</p>}
            <label>
              총예산 ({currencyLabel})
              <input
                inputMode="decimal"
                value={totalBudget}
                placeholder="직접 입력"
                onChange={(event) => setTotalBudget(event.target.value)}
              />
            </label>
            <label>
              비상금 ({currencyLabel})
              <input
                inputMode="decimal"
                value={reserve}
                onChange={(event) => setReserve(event.target.value)}
              />
            </label>
            <label>
              한 끼 예산 (1인·{currencyLabel})
              <input
                inputMode="decimal"
                value={mealBudget}
                placeholder="선택"
                onChange={(event) => setMealBudget(event.target.value)}
              />
            </label>
            <button type="submit">예산 저장</button>
          </form>
        </section>

        <section className="budget-card" aria-labelledby="expense-form-title">
          <h2 id="expense-form-title">지출 추가</h2>
          <form onSubmit={addExpense}>
            <label>지출 통화<select value={expenseCurrency} onChange={event => { if (isCurrencyCode(event.target.value)) { setExpenseCurrency(event.target.value); setRate(""); } }}>
              {SUPPORTED_CURRENCIES.map(code => <option key={code}>{code}</option>)}
            </select></label>
            {expenseCurrency === baseCurrency ? null : <label>환율 (1 {expenseCurrency} = {baseCurrency})<input inputMode="decimal" value={rate} onChange={event => setRate(event.target.value)} /><small>이 지출에 고정해 저장합니다.</small></label>}
            {expenseError === null ? null : <p role="alert">{expenseError}</p>}
            <label>
              지출 금액 ({expenseLabel})
              <input
                inputMode="decimal"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
              />
            </label>
            <div className="expense-quick-amounts" aria-label="빠른 금액 입력">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  aria-label={`${formatMoney(parseMoney(String(amount), expenseCurrency)!, expenseCurrency)} 입력`}
                  onClick={() => setExpenseAmount(String(amount))}
                >
                  {formatMoney(parseMoney(String(amount), expenseCurrency)!, expenseCurrency)}
                </button>
              ))}
            </div>
            <div className="budget-form-grid">
              <label>
                지출 분류
                <select
                  value={expenseCategory}
                  onChange={(event) =>
                    setExpenseCategory(event.target.value as ExpenseCategory)
                  }
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                지출 날짜
                <input
                  type="date"
                  min={workspace.schedule.startDate}
                  max={workspace.schedule.endDate}
                  value={expenseDate}
                  onChange={(event) => setExpenseDate(event.target.value)}
                />
              </label>
            </div>
            <label>
              지출 메모
              <input
                value={expenseNote}
                maxLength={200}
                placeholder="예: 물, 점심"
                onChange={(event) => setExpenseNote(event.target.value)}
              />
            </label>
            <button type="submit">지출 추가</button>
          </form>
        </section>

        <section className="budget-card planned-cost" aria-labelledby="planned-cost-title">
          <div className="budget-card__heading">
            <h2 id="planned-cost-title">일정 예정 비용</h2>
            <strong>{formatMoney(summary.plannedCostMinor, workspace.settings.localCurrency)}</strong>
          </div>
          <p>비용 미입력 일정 {summary.activitiesMissingCost}개 · 실제 지출과 별도</p>
          <ul>
            {summary.plannedCostByDate.map((day) => (
              <li key={day.date}>
                <span>{Number(day.date.slice(8, 10))}일</span>
                <strong>{formatMoney(day.amountMinor, workspace.settings.localCurrency)}</strong>
                <small>미입력 {day.missing}개</small>
              </li>
            ))}
          </ul>
        </section>

        <section className="budget-card expense-history" aria-labelledby="expense-history-title">
          <div className="budget-card__heading">
            <h2 id="expense-history-title">최근 지출</h2>
            <span>{orderedExpenses.length}건</span>
          </div>
          {orderedExpenses.length === 0 ? (
            <p>아직 기록한 지출이 없습니다.</p>
          ) : (
            <ul>
              {orderedExpenses.map((expense) => {
                const label = expense.note ?? categoryLabels[expense.category];
                return (
                  <li key={expense.id}>
                    <div>
                      <strong>{label}</strong>
                      <span>
                        {categoryLabels[expense.category]} · {zonedDate(expense.occurredAt, workspace.settings.timeZone).slice(5, 10)}
                      </span>
                    </div>
                    <strong>{formatMoney(expense.amount, expense.currency)}</strong>
                    {confirmDeleteId === expense.id ? (
                      <div className="expense-delete-confirm">
                        <span>이 지출을 삭제할까요?</span>
                        <button
                          type="button"
                          aria-label="지출 삭제 확인"
                          onClick={() => deleteExpense(expense.id)}
                        >
                          삭제
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)}>
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`${label} 지출 삭제`}
                        onClick={() => setConfirmDeleteId(expense.id)}
                      >
                        삭제
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function toTripDate(now: Date, startDate: string, endDate: string, timeZone: string): string {
  const date = zonedDate(now, timeZone);
  return date < startDate ? startDate : date > endDate ? endDate : date;
}
