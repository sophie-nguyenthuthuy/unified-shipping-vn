import { z } from "zod";

/**
 * The normalized shipment lifecycle. Carriers map onto this; see
 * each adapter's status-mapping.ts for the carrier-specific table.
 *
 * Terminal states: delivered, returned, lost, cancelled.
 */
export const ShipmentStatus = z.enum([
  "pending",
  "ready_to_pickup",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivery_failed",
  "delivered",
  "returning",
  "returned",
  "cancelled",
  "lost",
  "on_hold",
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatus>;

export const TERMINAL_STATUSES: ReadonlySet<ShipmentStatus> = new Set([
  "delivered",
  "returned",
  "cancelled",
  "lost",
]);

export const isTerminal = (s: ShipmentStatus): boolean => TERMINAL_STATUSES.has(s);

const ORDER: Record<ShipmentStatus, number> = {
  pending: 0,
  ready_to_pickup: 1,
  picked_up: 2,
  in_transit: 3,
  out_for_delivery: 4,
  delivery_failed: 5,
  on_hold: 5,
  delivered: 6,
  returning: 6,
  returned: 7,
  cancelled: 7,
  lost: 7,
};

/**
 * True if `next` is a permissible transition from `prev`. Used to drop
 * out-of-order webhook events (carriers occasionally send these).
 */
export const isForwardTransition = (prev: ShipmentStatus, next: ShipmentStatus): boolean => {
  if (prev === next) return true;
  if (TERMINAL_STATUSES.has(prev)) return false;
  return ORDER[next] >= ORDER[prev];
};
