import { describe, expect, it } from "vitest";
import { encodeAuditCursor, parseAuditFilters } from "./query-audit";

describe("parseAuditFilters", () => {
  it("ignora entidade desconhecida e data inválida", () => {
    const f = parseAuditFilters(new URLSearchParams("entidade=hack&de=ontem&ate=2026-13-45&cursor=lixo"));
    expect(f).toEqual({ entity: null, person: null, from: null, until: null, cursor: null });
  });

  it("aceita entidade conhecida e pessoa", () => {
    const f = parseAuditFilters(new URLSearchParams("entidade=product&pessoa=%20Ana%20"));
    expect(f.entity).toBe("product");
    expect(f.person).toBe("Ana");
  });

  it("`de` começa à meia-noite e `ate` inclui o dia inteiro em horário de Brasília", () => {
    const f = parseAuditFilters(new URLSearchParams("de=2026-11-04&ate=2026-11-04"));
    expect(f.from?.toISOString()).toBe("2026-11-04T03:00:00.000Z");
    // limite exclusivo: meia-noite do dia seguinte em Brasília
    expect(f.until?.toISOString()).toBe("2026-11-05T03:00:00.000Z");
  });

  it("round-trip do cursor preserva microssegundos", () => {
    const at = "2026-11-04T12:00:00.123456Z";
    const id = "11111111-1111-4111-8111-111111111111";
    const f = parseAuditFilters(new URLSearchParams({ cursor: encodeAuditCursor({ createdAt: at, id }) }));
    expect(f.cursor).toEqual({ createdAt: at, id });
  });
});
