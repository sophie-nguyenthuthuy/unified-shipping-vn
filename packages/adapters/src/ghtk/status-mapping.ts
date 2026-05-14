import type { ShipmentStatus } from "@usv/core";

/**
 * GHTK numeric status_id → normalized ShipmentStatus.
 *
 * GHTK status IDs (from their partner API docs):
 *   -1: Đã hủy đơn (cancelled)
 *    1: Chưa tiếp nhận (pending pickup confirmation)
 *    2: Đã tiếp nhận (accepted by GHTK)
 *   12: Đã điều phối lấy hàng / Đang lấy hàng (dispatched for pickup)
 *   13: Đã lấy hàng / Đã nhập kho (picked up and stored)
 *    3: Đã lấy hàng / Đang vận chuyển (picked up, in transit) — legacy alias
 *    4: Đã điều phối giao hàng / Đang giao hàng (out for delivery)
 *    5: Đã giao hàng / Chưa đối soát (delivered, awaiting reconciliation)
 *    6: Đã đối soát (reconciled — terminal from COD perspective)
 *    7: Không lấy được hàng (pickup failed)
 *    8: Hoãn lấy hàng (pickup deferred)
 *    9: Không giao được hàng (delivery failed)
 *   10: Delay giao hàng (delivery delayed)
 *   20: Đang trả hàng (in return transit)
 *   21: Đã trả hàng / Chưa đối soát (returned to sender)
 *   11: Đã đối soát công nợ trả hàng (return reconciled)
 *  123: Shipper báo đã lấy hàng (driver-side pickup mark)
 *  127, 128: Shipper báo không lấy được / không giao được
 *  -2: Lỗi không xác định (unknown error)
 *
 * Anything not in this table maps to `in_transit` so we never lose a shipment
 * to an unrecognised code; the raw value is preserved on the tracking event.
 */
const TABLE: Record<number, ShipmentStatus> = {
  [-1]: "cancelled",
  1: "pending",
  2: "ready_to_pickup",
  12: "ready_to_pickup",
  13: "picked_up",
  3: "in_transit",
  4: "out_for_delivery",
  5: "delivered",
  6: "delivered",
  7: "on_hold",
  8: "on_hold",
  9: "delivery_failed",
  10: "delivery_failed",
  20: "returning",
  21: "returned",
  11: "returned",
  123: "picked_up",
  127: "on_hold",
  128: "delivery_failed",
  [-2]: "on_hold",
};

export const mapGhtkStatus = (raw: number | string): ShipmentStatus => {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  if (!Number.isFinite(n)) return "in_transit";
  return TABLE[n] ?? "in_transit";
};
