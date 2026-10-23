import { describe, it } from "vitest";
import fc from "fast-check";
import { estimateCommission, reconcileCommission } from "./commission";
import { money } from "../lib/money";
import { Decimal } from "../lib/decimal";

describe("Commission Domain Property Tests (fast-check)", () => {
  it("Invariant 1: grossAmount selalu persis sama dengan netAmount + commissionAmount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10_000, max: 500_000_000 }), // Nilai IDR realistis
        fc.integer({ min: 0, max: 3000 }), // Rate 0.0000 - 0.3000 (0% - 30%)
        (rawGross, rawRate) => {
          const gross = money(rawGross.toString(), "IDR");
          const rate = new Decimal(rawRate).dividedBy(10_000);

          const res = estimateCommission(gross, rate);

          // gross === net + commission
          const sum = res.netAmount.amount.plus(res.commissionAmount.amount);
          return sum.equals(res.grossAmount.amount);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("Invariant 2: netAmount tidak pernah melebihi grossAmount untuk rate non-negatif", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.integer({ min: 0, max: 10_000 }), // Rate 0% - 100%
        (rawGross, rawRate) => {
          const gross = money(rawGross.toString(), "IDR");
          const rate = new Decimal(rawRate).dividedBy(10_000);

          const res = estimateCommission(gross, rate);
          return res.netAmount.amount.lessThanOrEqualTo(res.grossAmount.amount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Invariant 3: Variance komisi selalu persis actualCommission - estimatedCommission", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100_000, max: 50_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (rawGross, rawEst, rawAct) => {
          const gross = money(rawGross.toString(), "IDR");
          const est = money(rawEst.toString(), "IDR");
          const act = money(rawAct.toString(), "IDR");

          const res = reconcileCommission({
            bookingId: "test-b",
            channel: "AIRBNB",
            externalId: "HM123",
            grossAmount: gross,
            estimatedCommission: est,
            actualCommission: act,
          });

          return res.variance.amount.equals(act.amount.minus(est.amount));
        },
      ),
      { numRuns: 100 },
    );
  });
});
