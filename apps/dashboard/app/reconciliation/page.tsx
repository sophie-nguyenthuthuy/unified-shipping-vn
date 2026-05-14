import { getDb } from "@usv/db";
import { summarizeMerchant } from "@usv/reconciliation";

import { requireSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage() {
  const session = await requireSession();
  const db = getDb();

  const entries = await db.codLedgerEntry.findMany({
    where: { merchantId: session.merchantId },
    select: { shipmentId: true, kind: true, amount: true },
  });
  const grouped = new Map<string, Array<{ kind: string; amountMinor: bigint }>>();
  for (const e of entries) {
    const arr = grouped.get(e.shipmentId);
    const next = { kind: e.kind, amountMinor: e.amount };
    if (arr) arr.push(next);
    else grouped.set(e.shipmentId, [next]);
  }
  const summary = summarizeMerchant(
    [...grouped.entries()].map(([shipmentId, es]) => ({
      shipmentId,
      entries: es as Array<{ kind: "expected" | "collected" | "remitted" | "adjusted" | "disputed"; amountMinor: bigint }>,
    })),
  );

  const disputes = await db.reconciliationDispute.findMany({
    where: { merchantId: session.merchantId, status: { in: ["open", "carrier_contacted", "awaiting_response"] } },
    orderBy: { openedAt: "desc" },
    take: 20,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">COD reconciliation</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Expected" value={summary.totalExpectedMinor} />
        <Stat label="Collected" value={summary.totalCollectedMinor} />
        <Stat label="Remitted" value={summary.totalRemittedMinor} />
        <Stat label="Outstanding" value={summary.outstandingMinor} emphasize />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Open disputes ({disputes.length})</h2>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr className="[&>th]:border-b [&>th]:py-2 [&>th]:pr-3">
            <th>Kind</th>
            <th>Carrier</th>
            <th>Shipment</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Opened</th>
          </tr>
        </thead>
        <tbody>
          {disputes.map((d) => (
            <tr key={d.id} className="[&>td]:border-b [&>td]:py-2 [&>td]:pr-3">
              <td>{d.kind}</td>
              <td>{d.carrier}</td>
              <td className="font-mono text-xs">{d.shipmentId ?? "—"}</td>
              <td>{d.expectedAmt?.toString() ?? "—"}</td>
              <td>{d.actualAmt?.toString() ?? "—"}</td>
              <td className="text-xs text-gray-500">{d.openedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
          {disputes.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-400">
                Nothing to dispute. Reconciliation is clean.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: bigint; emphasize?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${emphasize ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value.toString()} ₫</div>
    </div>
  );
}
