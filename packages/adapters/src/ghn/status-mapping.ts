import type { ShipmentStatus } from "@usv/core";

/**
 * GHN's internal status enum → our normalized statuses.
 * Source: GHN API v2 documentation. Anything not enumerated maps to
 * `in_transit` with the raw code preserved on the tracking event.
 */
const TABLE: Record<string, ShipmentStatus> = {
  ready_to_pick: "ready_to_pickup",
  picking: "ready_to_pickup",
  cancel: "cancelled",
  money_collect_picking: "ready_to_pickup",
  picked: "picked_up",
  storing: "in_transit",
  transporting: "in_transit",
  sorting: "in_transit",
  delivering: "out_for_delivery",
  money_collect_delivering: "out_for_delivery",
  delivered: "delivered",
  delivery_fail: "delivery_failed",
  waiting_to_return: "returning",
  return: "returning",
  return_transporting: "returning",
  return_sorting: "returning",
  returning: "returning",
  return_fail: "returning",
  returned: "returned",
  exception: "on_hold",
  damage: "on_hold",
  lost: "lost",
};

export const mapGhnStatus = (raw: string): ShipmentStatus => TABLE[raw] ?? "in_transit";
