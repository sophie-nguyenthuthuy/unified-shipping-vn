import { getDb } from "@usv/db";

import { requireSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage() {
  const session = await requireSession();
  const db = getDb();
  const rows = await db.shipment.findMany({
    where: { merchantId: session.merchantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Shipments</h1>
      <table className="mt-6 w-full border-separate border-spacing-0 text-sm">
        <thead className="text-left text-gray-500">
          <tr className="[&>th]:border-b [&>th]:border-gray-200 [&>th]:py-2 [&>th]:pr-4">
            <th>Order ID</th>
            <th>Carrier</th>
            <th>Tracking</th>
            <th>Status</th>
            <th>COD</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="[&>td]:border-b [&>td]:border-gray-100 [&>td]:py-2 [&>td]:pr-4">
              <td className="font-mono text-xs">{r.merchantOrderId}</td>
              <td>{r.carrier}</td>
              <td className="font-mono text-xs">{r.carrierTrackingCode}</td>
              <td>
                <StatusPill status={r.status} />
              </td>
              <td>{r.cashOnDeliveryAmt.toString()} ₫</td>
              <td className="text-xs text-gray-500">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-400">
                No shipments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "delivered"
      ? "bg-green-50 text-green-700"
      : status === "cancelled" || status === "returned" || status === "lost"
        ? "bg-gray-100 text-gray-600"
        : status === "delivery_failed" || status === "on_hold"
          ? "bg-amber-50 text-amber-700"
          : "bg-blue-50 text-blue-700";
  return <span className={`rounded px-2 py-0.5 text-xs ${color}`}>{status}</span>;
}
