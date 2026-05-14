import { z } from "zod";

import { ShipmentStatus } from "./status.js";

export const TrackingEvent = z.object({
  status: ShipmentStatus,
  occurredAt: z.string().datetime(),
  location: z.string().optional(),
  note: z.string().optional(),
  carrierRawCode: z.string().optional(),
  carrierRawDescription: z.string().optional(),
});
export type TrackingEvent = z.infer<typeof TrackingEvent>;

export const TrackingTimeline = z.object({
  carrierTrackingCode: z.string(),
  currentStatus: ShipmentStatus,
  events: z.array(TrackingEvent),
});
export type TrackingTimeline = z.infer<typeof TrackingTimeline>;
