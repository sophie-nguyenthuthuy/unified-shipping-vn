import { Worker, type Job } from "bullmq";

import { getDb } from "@usv/db";
import { createLogger, reconciliationDisputesOpenedTotal } from "@usv/observability";
import {
  matchRemittance,
  type ExpectedEntry,
  type LineClassification,
  type RemittanceLine,
} from "@usv/reconciliation";

import type { QueueSet, ReconciliationJob } from "../queues.js";

const log = createLogger("worker.reconciliation");

export const startReconciliationCron = (opts: { queues: QueueSet }) => {
  const db = getDb();

  void opts.queues.reconciliation.add(
    "daily-sweep",
    { merchantId: "*", carrier: "*", from: "", to: "" },
    {
      repeat: { pattern: "15 2 * * *" },
      jobId: "daily-sweep",
    },
  );

  const worker = new Worker<ReconciliationJob>(
    "reconciliation",
    async (job: Job<ReconciliationJob>) => {
      if (job.name === "daily-sweep") {
        await runDailySweep();
        return;
      }
      await reconcileMerchantCarrier(job.data);
    },
    { connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379/0" }, concurrency: 4 },
  );

  const runDailySweep = async () => {
    const targets = await db.carrierAccount.findMany({
      where: { active: true },
      select: { merchantId: true, carrier: true },
      distinct: ["merchantId", "carrier"],
    });
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
    const to = new Date().toISOString();
    for (const t of targets) {
      await opts.queues.reconciliation.add("reconcile", { ...t, from, to });
    }
  };

  const reconcileMerchantCarrier = async (j: ReconciliationJob) => {
    log.info({ ...j }, "reconciling");
    const expectedRows = await db.codLedgerEntry.findMany({
      where: { merchantId: j.merchantId, carrier: j.carrier, kind: "expected" },
      select: { shipmentId: true, amount: true, shipment: { select: { carrierTrackingCode: true } } },
    });
    const expected: ExpectedEntry[] = expectedRows.map((r) => ({
      shipmentId: r.shipmentId,
      carrierTrackingCode: r.shipment.carrierTrackingCode,
      amountMinor: r.amount,
    }));

    const lineRows = await db.remittanceLine.findMany({
      where: {
        remittance: {
          merchantId: j.merchantId,
          carrier: j.carrier,
          reportPeriodEnd: { gte: new Date(j.from), lte: new Date(j.to) },
        },
        matched: false,
      },
    });
    const lines: RemittanceLine[] = lineRows.map((r) => ({
      id: r.id,
      carrierTrackingCode: r.carrierTrackingCode,
      collectedMinor: r.collectedAmt,
      feeMinor: r.feeAmt,
      netMinor: r.netAmt,
    }));

    const results = matchRemittance(expected, lines);

    for (const result of results) {
      await persistResult(j, result);
    }
    log.info({ ...j, count: results.length }, "reconciliation done");
  };

  const persistResult = async (j: ReconciliationJob, r: LineClassification) => {
    if (r.kind === "matched") {
      await db.remittanceLine.update({
        where: { id: r.lineId },
        data: { matched: true, matchedShipmentId: r.shipmentId, matchStatus: "matched" },
      });
    } else if (r.kind === "amount_mismatch") {
      await db.$transaction([
        db.remittanceLine.update({
          where: { id: r.lineId },
          data: { matched: false, matchedShipmentId: r.shipmentId, matchStatus: "amount_mismatch" },
        }),
        db.reconciliationDispute.create({
          data: {
            id: cryptoId("dsp"),
            merchantId: j.merchantId,
            carrier: j.carrier,
            shipmentId: r.shipmentId,
            remittanceLineId: r.lineId,
            kind: "amount_mismatch",
            expectedAmt: r.expectedMinor,
            actualAmt: r.actualMinor,
          },
        }),
      ]);
      reconciliationDisputesOpenedTotal().add(1, { kind: "amount_mismatch", carrier: j.carrier });
    } else if (r.kind === "duplicate") {
      await db.reconciliationDispute.create({
        data: {
          id: cryptoId("dsp"),
          merchantId: j.merchantId,
          carrier: j.carrier,
          shipmentId: r.shipmentId,
          kind: "duplicate",
          notes: { lineIds: r.lineIds } as never,
        },
      });
      reconciliationDisputesOpenedTotal().add(1, { kind: "duplicate", carrier: j.carrier });
    } else if (r.kind === "unmatched_expected") {
      await db.reconciliationDispute.create({
        data: {
          id: cryptoId("dsp"),
          merchantId: j.merchantId,
          carrier: j.carrier,
          shipmentId: r.shipmentId,
          kind: "missing_remittance",
        },
      });
      reconciliationDisputesOpenedTotal().add(1, { kind: "missing_remittance", carrier: j.carrier });
    } else if (r.kind === "unmatched_line") {
      await db.remittanceLine.update({
        where: { id: r.lineId },
        data: { matched: false, matchStatus: "unmatched" },
      });
    }
  };

  return worker;
};

import { randomBytes } from "node:crypto";
const cryptoId = (prefix: string) => `${prefix}_${randomBytes(11).toString("hex").slice(0, 22)}`;
