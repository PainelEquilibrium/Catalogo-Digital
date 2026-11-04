import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), audit: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  requireSignedInProfile: m.session,
  createServerSupabase: async () => ({ auth: { updateUser: async () => ({ error: null }) } }),
}));
vi.mock("@/lib/prisma/client", () => {
  const tx = { profile: { update: m.update }, auditLog: { create: m.audit } };
  return { prisma: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
import { changeOwnPassword } from "./actions";

const input = { password: "senha-nova-1", confirmation: "senha-nova-1" };
beforeEach(() => vi.resetAllMocks());

it("suporte: actorName e entityLabel não expõem nome nem e-mail reais", async () => {
  m.session.mockResolvedValue({ userId: "u", email: "real@pessoa.com", name: "Pessoa Real", role: "support", mustChangePassword: true });
  expect(await changeOwnPassword(input)).toEqual({ ok: true });
  const data = m.audit.mock.calls[0][0].data;
  expect(data.actorName).toBe("Suporte Equilibrium");
  expect(data.entityLabel).toBe("Suporte Equilibrium");
  expect(JSON.stringify(data)).not.toMatch(/Pessoa Real|real@pessoa\.com|senha-nova/);
});

it("falha de banco devolve mensagem em vez de lançar", async () => {
  m.session.mockResolvedValue({ userId: "u", email: "a@b.c", name: "Ana", role: "manager", mustChangePassword: true });
  m.update.mockRejectedValue(new Error("db"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await changeOwnPassword(input)).toEqual(expect.objectContaining({ ok: false }));
  log.mockRestore();
});
