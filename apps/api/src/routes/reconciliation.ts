import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { summarizeMerchant } from "@usv/reconciliation";

const ListDisputesQuery = z.object({
  status: z.enum(["open", "carrier_contacted", "awaiting_response", "resolved", "written_off"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const reconciliationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/reconciliation/summary", async (req) => {
    const merchantId = req.merchantId!;
    const entries = await app.db.codLedgerEntry.findMany({
      where: { merchantId },
      select: { shipmentId: true, kind: true, amount: true },
    });
    const grouped = new Map<string, { shipmentId: string; entries: Array<{ kind: string; amountMinor: bigint }> }>();
    for (const e of entries) {
      const g = grouped.get(e.shipmentId);
      const entry = { kind: e.kind, amountMinor: e.amount };
      if (g) g.entries.push(entry);
      else grouped.set(e.shipmentId, { shipmentId: e.shipmentId, entries: [entry] });
    }
    const summary = summarizeMerchant(
      [...grouped.values()].map((g) => ({
        shipmentId: g.shipmentId,
        entries: g.entries as Array<{ kind: "expected" | "collected" | "remitted" | "adjusted" | "disputed"; amountMinor: bigint }>,
      })),
    );
    return {
      shipmentCount: summary.shipmentCount,
      totalExpected: String(summary.totalExpectedMinor),
      totalCollected: String(summary.totalCollectedMinor),
      totalRemitted: String(summary.totalRemittedMinor),
      outstanding: String(summary.outstandingMinor),
      currency: "VND",
    };
  });

  app.get("/reconciliation/disputes", async (req) => {
    const merchantId = req.merchantId!;
    const q = ListDisputesQuery.parse(req.query ?? {});
    const items = await app.db.reconciliationDispute.findMany({
      where: { merchantId, ...(q.status ? { status: q.status } : {}) },
      orderBy: { openedAt: "desc" },
      take: q.limit,
    });
    return { data: items };
  });
};
