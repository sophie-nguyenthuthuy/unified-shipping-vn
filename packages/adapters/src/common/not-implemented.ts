import { UsvError } from "@usv/core";

export const notImplemented = (carrier: string, operation: string): never => {
  throw new UsvError({
    code: "feature_disabled",
    httpStatus: 501,
    message: `${carrier}.${operation} is not yet implemented`,
    details: { carrier, operation },
  });
};
