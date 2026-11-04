import { randomBytes } from "node:crypto";

export const generateTempPassword = (): string => randomBytes(18).toString("base64url");
