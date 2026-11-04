import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";

export const AUDIT_PAGE_SIZE = 50;

export const AUDIT_ENTITIES = ["product", "category", "image", "settings", "person", "system"] as const;

type Cursor = { createdAt: Date; id: string };

export type AuditFilters = {
  entity: string | null;
  person: string | null;
  from: Date | null;
  /** Limite exclusivo: meia-noite do dia seguinte em Brasília. */
  until: Date | null;
  cursor: Cursor | null;
};

export type AuditRow = {
  id: string;
  actorName: string;
  entityType: string;
  entityLabel: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Brasília sem horário de verão desde 2019: offset fixo -03:00.
function brtMidnight(day: string | null, plusDays = 0): Date | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T00:00:00-03:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d;
}

export function encodeAuditCursor(c: Cursor): string {
  return `${c.createdAt.toISOString()}_${c.id}`;
}

function decodeCursor(raw: string | null): Cursor | null {
  const [iso, id] = raw?.split("_") ?? [];
  if (!iso || !id || !UUID.test(id)) return null;
  const createdAt = new Date(iso);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}

export function parseAuditFilters(params: URLSearchParams): AuditFilters {
  const entity = params.get("entidade");
  return {
    entity: AUDIT_ENTITIES.find((e) => e === entity) ?? null,
    person: params.get("pessoa")?.trim() || null,
    from: brtMidnight(params.get("de")),
    until: brtMidnight(params.get("ate"), 1),
    cursor: decodeCursor(params.get("cursor")),
  };
}

export async function queryAudit(
  filters: AuditFilters,
): Promise<{ rows: AuditRow[]; nextCursor: string | null }> {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (filters.cursor) {
    and.push({
      OR: [
        { createdAt: { lt: filters.cursor.createdAt } },
        { createdAt: filters.cursor.createdAt, id: { lt: filters.cursor.id } },
      ],
    });
  }
  const found = await prisma.auditLog.findMany({
    where: {
      ...(filters.entity ? { entityType: filters.entity } : {}),
      ...(filters.person ? { actorName: { contains: filters.person, mode: "insensitive" } } : {}),
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.until ? { lt: filters.until } : {}),
      },
      AND: and,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: AUDIT_PAGE_SIZE + 1,
  });
  const rows = found.slice(0, AUDIT_PAGE_SIZE);
  const last = rows.at(-1);
  return {
    rows: rows.map(({ id, actorName, entityType, entityLabel, action, before, after, createdAt }) => ({
      id, actorName, entityType, entityLabel, action, before, after, createdAt,
    })),
    nextCursor: found.length > AUDIT_PAGE_SIZE && last ? encodeAuditCursor(last) : null,
  };
}
