/**
 * Dispute state machine.
 *
 *   open ─► carrier_contacted ─► awaiting_response ─► resolved
 *                                                └─► written_off
 *
 * Backwards transitions are not allowed; reopen by creating a new dispute.
 */
export type DisputeStatus = "open" | "carrier_contacted" | "awaiting_response" | "resolved" | "written_off";

const ALLOWED: Record<DisputeStatus, ReadonlySet<DisputeStatus>> = {
  open: new Set(["carrier_contacted", "written_off", "resolved"]),
  carrier_contacted: new Set(["awaiting_response", "resolved", "written_off"]),
  awaiting_response: new Set(["resolved", "carrier_contacted", "written_off"]),
  resolved: new Set(),
  written_off: new Set(),
};

export const canTransition = (from: DisputeStatus, to: DisputeStatus): boolean => ALLOWED[from].has(to);

export const isTerminalDispute = (s: DisputeStatus): boolean => s === "resolved" || s === "written_off";

export type DisputeKind =
  | "missing_remittance"
  | "amount_mismatch"
  | "duplicate"
  | "late_remittance";

export interface DraftDispute {
  kind: DisputeKind;
  shipmentId?: string;
  remittanceLineId?: string;
  expectedMinor?: bigint;
  actualMinor?: bigint;
}
