import { z } from "zod";

const emailSchema = z.string().email();

export function normalizeLoginEmail(raw: string): string | null {
  const parsed = emailSchema.safeParse(raw.trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}
