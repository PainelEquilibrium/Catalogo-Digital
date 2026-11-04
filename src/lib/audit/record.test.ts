import { expect, it, vi } from "vitest";
import type { StaffSession } from "@/lib/auth/server";
import { auditActorFor, recordAudit, sanitizeAuditValue } from "./record";

const base: StaffSession = { userId: "u1", email: "a@b.c", name: "Ana", role: "owner" };

it("sanitize remove password, tempPassword, access_token em qualquer nível", () => {
  const out = sanitizeAuditValue({
    name: "x",
    password: "1",
    nested: { tempPassword: "2", list: [{ access_token: "3", ok: 1 }] },
  });
  expect(out).toEqual({ name: "x", nested: { list: [{ ok: 1 }] } });
});

it("auditActorFor mascara suporte", () => {
  expect(auditActorFor({ ...base, role: "support" })).toEqual({
    id: "u1",
    name: "Suporte Equilibrium",
  });
});

it("auditActorFor usa o nome, ou o e-mail se o nome estiver vazio", () => {
  expect(auditActorFor(base).name).toBe("Ana");
  expect(auditActorFor({ ...base, name: "  " }).name).toBe("a@b.c");
});

it("recordAudit grava com o tx recebido", async () => {
  const create = vi.fn();
  await recordAudit({ auditLog: { create } } as never, { id: "u1", name: "Ana" }, {
    entityType: "product",
    entityId: "p1",
    entityLabel: "Vestido",
    action: "create",
    after: { name: "Vestido", token: "x" },
  });
  expect(create).toHaveBeenCalledWith({
    data: {
      actorId: "u1",
      actorName: "Ana",
      entityType: "product",
      entityId: "p1",
      entityLabel: "Vestido",
      action: "create",
      before: undefined,
      after: { name: "Vestido" },
    },
  });
});
