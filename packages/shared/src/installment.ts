// Installment calculator (contract §8.11). Developer plans are usually 0% interest.

export type InstallmentPlan = {
  /** Down payment, in EGP. */
  down: number;
  /** What is left to pay after the down payment. */
  principal: number;
  /** Number of payments. */
  count: number;
  /** Each payment (monthly, or quarterly). */
  payment: number;
  /** Down payment plus every payment. */
  total: number;
};

export function installment(price: number, downPct: number, years: number, ratePct = 0, quarterly = false): InstallmentPlan {
  const down = (price * downPct) / 100;
  const principal = price - down;
  const perYear = quarterly ? 4 : 12;
  const count = Math.max(1, Math.round(years * perYear));
  const r = ratePct / 100 / perYear;
  const payment = r === 0 ? principal / count : (principal * r) / (1 - Math.pow(1 + r, -count));
  return { down, principal, count, payment, total: down + payment * count };
}
