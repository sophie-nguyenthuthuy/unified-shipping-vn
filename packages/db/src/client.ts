import { PrismaClient } from "@prisma/client";

export type Db = PrismaClient;

let _instance: PrismaClient | null = null;

export const getDb = (): PrismaClient => {
  if (!_instance) {
    _instance = new PrismaClient({
      log:
        process.env.NODE_ENV === "production"
          ? [{ emit: "event", level: "error" }]
          : [
              { emit: "event", level: "warn" },
              { emit: "event", level: "error" },
            ],
    });
  }
  return _instance;
};

export const disconnect = async (): Promise<void> => {
  if (_instance) {
    await _instance.$disconnect();
    _instance = null;
  }
};
