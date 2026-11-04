import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAuditFilters, queryAudit } from "./query-audit";

// Opt-in: RUN_RLS_INTEGRATION=1, RLS_DEV_PROJECT_REF=<ref>, RLS_DEV_CONFIRM=DEV:<ref>; usa DIRECT_URL/DATABASE_URL.
const enabled = process.env.RUN_RLS_INTEGRATION === "1";
const actor = `e2e-cursor-${Date.now()}`;
let db: Client;

describe.runIf(enabled)("queryAudit cursor", () => {
  beforeAll(async () => {
    db = new Client({ connectionString: process.env.DIRECT_URL });
    await db.connect();
    // 60 linhas no mesmo created_at + 6 linhas a microssegundos de distância dentro de 1 ms
    await db.query(
      `insert into audit_log (actor_name, entity_type, entity_id, entity_label, action, created_at)
       select $1, 'system', 'x', 'same-' || g, 'create', timestamptz '2026-01-01 12:00:00.123456+00' from generate_series(1, 60) g`,
      [actor],
    );
    await db.query(
      `insert into audit_log (actor_name, entity_type, entity_id, entity_label, action, created_at)
       select $1, 'system', 'x', 'us-' || g, 'create', timestamptz '2026-01-01 12:00:00.123000+00' + (g || ' microseconds')::interval
       from generate_series(1, 6) g`,
      [actor],
    );
  });
  afterAll(async () => {
    await db?.query("delete from audit_log where actor_name = $1", [actor]);
    await db?.end();
  });

  it("percorre todas as páginas sem pular nem duplicar", async () => {
    const expected = (await db.query("select id from audit_log where actor_name = $1", [actor])).rows.map((r) => r.id).sort();
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams({ pessoa: actor });
      if (cursor) params.set("cursor", cursor);
      const page = await queryAudit(parseAuditFilters(params));
      seen.push(...page.rows.map((r) => r.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(66);
    expect(new Set(seen).size).toBe(66);
    expect([...seen].sort()).toEqual(expected);
  });
});
