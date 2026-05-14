import type { FastifyPluginAsync } from "fastify";

import {
  CreateShipmentRequest,
  CancelShipmentRequest,
  CursorPageRequest,
  NotFoundError,
  ShipmentStatus,
  newId,
  vnd,
} from "@usv/core";
import { insertShipment, listShipments, findShipmentForMerchant, updateShipmentStatus } from "@usv/db";

import { createShipmentService, cancelShipmentService, trackShipmentService } from "../services/shipments.js";

export const shipmentRoutes: FastifyPluginAsync = async (app) => {
  app.post("/shipments", async (req, reply) => {
    const body = CreateShipmentRequest.parse(req.body);
    const merchantId = req.merchantId!;
    const result = await createShipmentService(app, { merchantId, body, idempotencyKey: idemKey(req) });
    reply.status(201);
    return result;
  });

  app.get("/shipments", async (req) => {
    const merchantId = req.merchantId!;
    const q = (req.query ?? {}) as Record<string, string>;
    const page = CursorPageRequest.parse({
      cursor: q.cursor,
      limit: q.limit ? Number.parseInt(q.limit, 10) : undefined,
    });
    const status = q.status ? ShipmentStatus.parse(q.status) : undefined;
    return listShipments(app.db, {
      merchantId,
      cursor: page.cursor,
      limit: page.limit,
      status,
      carrier: q.carrier,
    });
  });

  app.get("/shipments/:id", async (req) => {
    const merchantId = req.merchantId!;
    const { id } = req.params as { id: string };
    const found = await findShipmentForMerchant(app.db, merchantId, id);
    if (!found) throw NotFoundError("shipment");
    return found;
  });

  app.post("/shipments/:id/cancel", async (req) => {
    const merchantId = req.merchantId!;
    const { id } = req.params as { id: string };
    const body = CancelShipmentRequest.parse(req.body ?? {});
    return cancelShipmentService(app, { merchantId, shipmentId: id, reason: body.reason });
  });

  app.get("/shipments/:id/tracking", async (req) => {
    const merchantId = req.merchantId!;
    const { id } = req.params as { id: string };
    return trackShipmentService(app, { merchantId, shipmentId: id });
  });
};

const idemKey = (req: { headers: Record<string, string | string[] | undefined> }): string | undefined => {
  const v = req.headers["idempotency-key"];
  return Array.isArray(v) ? v[0] : v;
};
