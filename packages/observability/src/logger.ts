import pino, { type Logger, type LoggerOptions } from "pino";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "*.password",
  "*.passwordHash",
  "*.secret",
  "*.token",
  "*.privateKey",
  "*.encryptedSecret",
];

export const createLogger = (service: string, level = process.env.LOG_LEVEL ?? "info"): Logger => {
  const opts: LoggerOptions = {
    level,
    base: { service, env: process.env.NODE_ENV ?? "development" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    formatters: {
      level: (label) => ({ level: label }),
    },
  };
  return pino(opts);
};

export type { Logger };
