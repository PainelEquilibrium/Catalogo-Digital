import type { Prisma } from "@/generated/prisma/client";
import type { StaffSession } from "@/lib/auth/server";

export type AuditActor = { id: string | null; name: string };

export const SYSTEM_ACTOR: AuditActor = { id: null, name: "Sistema" };

export function auditActorFor(session: StaffSession): AuditActor {
  if (session.role === "support") {
    return { id: session.userId, name: "Suporte Equilibrium" };
  }
  return { id: session.userId, name: session.name.trim() || session.email };
}

const SECRET_KEY = /password|token|secret/i;

export function sanitizeAuditValue(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (key, v) => (SECRET_KEY.test(key) ? undefined : v)),
  ) as Prisma.InputJsonValue;
}

export type AuditEntry = {
  entityType: "product" | "category" | "image" | "settings" | "person" | "system";
  entityId: string;
  entityLabel: string;
  action: string;
  before?: unknown;
  after?: unknown;
};

export async function recordAudit(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  entry: AuditEntry,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      action: entry.action,
      before: sanitizeAuditValue(entry.before),
      after: sanitizeAuditValue(entry.after),
    },
  });
}
