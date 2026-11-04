import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";

export const AUDIT_PAGE_SIZE = 50;

export const AUDIT_ENTITIES = ["product", "category", "image", "settings", "person", "system"] as const;

/** createdAt: ISO UTC em texto, com microssegundos. */
type Cursor = { createdAt: string; id: string };

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

const CURSOR_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
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
  return `${c.createdAt}_${c.id}`;
}

function decodeCursor(raw: string | null): Cursor | null {
  const [iso, id] = raw?.split("_") ?? [];
  if (!iso || !id || !UUID.test(id) || !CURSOR_TS.test(iso) || Number.isNaN(new Date(iso).getTime())) return null;
  return { createdAt: iso, id };
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

type RawRow = Omit<AuditRow, "createdAt"> & { createdAt: Date; createdAtUs: string };

// $queryRaw: o cursor leva o timestamp como texto com microssegundos; passar por Date (ms) pularia linhas.
export async function queryAudit(
  filters: AuditFilters,
): Promise<{ rows: AuditRow[]; nextCursor: string | null }> {
  const conds: Prisma.Sql[] = [];
  if (filters.entity) conds.push(Prisma.sql`entity_type = ${filters.entity}`);
  if (filters.person) conds.push(Prisma.sql`position(lower(${filters.person}) in lower(actor_name)) > 0`);
  if (filters.from) conds.push(Prisma.sql`created_at >= ${filters.from}::timestamptz`);
  if (filters.until) conds.push(Prisma.sql`created_at < ${filters.until}::timestamptz`);
  if (filters.cursor) {
    conds.push(Prisma.sql`(created_at, id) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id}::uuid)`);
  }
  const where = conds.length ? Prisma.sql`where ${Prisma.join(conds, " and ")}` : Prisma.empty;
  const found = await prisma.$queryRaw<RawRow[]>`
    select id::text as id, actor_name as "actorName", entity_type as "entityType",
      entity_label as "entityLabel", action, before, after, created_at as "createdAt",
      to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAtUs"
    from audit_log ${where}
    order by created_at desc, id desc
    limit ${AUDIT_PAGE_SIZE + 1}`;
  const page = found.slice(0, AUDIT_PAGE_SIZE);
  const last = page.at(-1);
  return {
    rows: page.map(({ createdAtUs: _us, ...row }) => row),
    nextCursor: found.length > AUDIT_PAGE_SIZE && last ? encodeAuditCursor({ createdAt: last.createdAtUs, id: last.id }) : null,
  };
}
