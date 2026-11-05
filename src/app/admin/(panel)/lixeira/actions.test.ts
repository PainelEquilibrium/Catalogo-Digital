import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAction: vi.fn(), purgeProduct: vi.fn(), purgeCategory: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ requireAction: m.requireAction, requireStaff: vi.fn() }));
vi.mock("@/lib/maintenance/purge-trash", () => ({ purgeProduct: m.purgeProduct, purgeCategory: m.purgeCategory }));
vi.mock("@/lib/prisma/client", () => ({ prisma: {} }));
import { purgeTrashedCategory, purgeTrashedProduct } from "./actions";

beforeEach(() => vi.resetAllMocks());

it("gestor (requireAction nega): nenhuma exclusão é chamada, em produto e categoria", async () => {
  m.requireAction.mockRejectedValue(new Error("forbidden"));
  await expect(purgeTrashedProduct("p1")).rejects.toThrow("forbidden");
  await expect(purgeTrashedCategory("c1")).rejects.toThrow("forbidden");
  expect(m.requireAction).toHaveBeenCalledTimes(2);
  expect(m.requireAction).toHaveBeenCalledWith("purge");
  expect(m.purgeProduct).not.toHaveBeenCalled();
  expect(m.purgeCategory).not.toHaveBeenCalled();
});

it("dono: a exclusão roda com o ator da sessão", async () => {
  m.requireAction.mockResolvedValue({ userId: "u1", email: "a@b.c", name: "Dona", role: "owner" });
  m.purgeProduct.mockResolvedValue("purged");
  expect(await purgeTrashedProduct("p1")).toEqual({ ok: true });
  expect(m.purgeProduct).toHaveBeenCalledWith("p1", { id: "u1", name: "Dona" });
});
