import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), audit: vi.fn(), store: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ requireAction: vi.fn() }));
vi.mock("@/lib/prisma/client", () => {
  const tx = { category: { updateMany: m.update }, auditLog: { create: m.audit } };
  return { prisma: { category: { findFirst: m.find }, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
vi.mock("@/lib/images/upload", async (original) => ({ ...await original<object>(), storeProcessedImage: m.store, removeStorageObjects: m.remove }));
vi.mock("@/lib/auth/supabase-env", () => ({ getSupabasePublicConfig: () => ({ url: "https://project.supabase.co" }) }));
import { requireAction } from "@/lib/auth/server";
import { setCategoryCover } from "./actions";
const path = "originals/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";
const url = `https://project.supabase.co/storage/v1/object/public/product-image-variants/${path.replace("originals/", "variants/")}-card.webp`;
function form() { const f = new FormData(); f.set("file", new File(["test"], "test.png")); return f; }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(requireAction).mockResolvedValue({ userId: "u", email: "a@b.c", name: "Ana", role: "manager" }); m.find.mockResolvedValue({ id: "category", name: "Cat", coverStoragePath: path, coverImageUrl: url }); m.store.mockResolvedValue({ storagePath: path.replace("22222222-", "33333333-"), cardUrl: "new-url" }); m.update.mockResolvedValue({ count: 1 }); });
it("compensates new files when persistence fails", async () => { const error = new Error("database"); m.update.mockRejectedValue(error); expect(await setCategoryCover("category", form())).toEqual(expect.objectContaining({ ok: false })); expect(m.remove.mock.calls[0][0][0].path).toContain("33333333-"); expect(m.remove).toHaveBeenCalledTimes(1); });
it("saves with both previous references before cleanup", async () => { m.remove.mockImplementation(() => { expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "category", deletedAt: null, coverStoragePath: path, coverImageUrl: url } })); }); expect(await setCategoryCover("category", form())).toEqual({ ok: true, coverImageUrl: "new-url" }); });
it("keeps new cover when previous cleanup fails", async () => { m.remove.mockRejectedValue(new Error("cleanup")); const log = vi.spyOn(console, "error").mockImplementation(() => {}); expect(await setCategoryCover("category", form())).toEqual({ ok: true, coverImageUrl: "new-url", cleanupPending: true }); log.mockRestore(); });
it("CAS loser compensates only its own files", async () => { m.update.mockResolvedValue({ count: 0 }); expect(await setCategoryCover("category", form())).toEqual(expect.objectContaining({ ok: false })); expect(m.remove).toHaveBeenCalledTimes(1); expect(m.remove.mock.calls[0][0][0].path).toContain("33333333-"); });
it("never cleans an external previous cover", async () => { m.find.mockResolvedValue({ id: "category", name: "Cat", coverStoragePath: path, coverImageUrl: "https://external.test/photo" }); expect(await setCategoryCover("category", form())).toEqual({ ok: true, coverImageUrl: "new-url" }); expect(m.remove).not.toHaveBeenCalled(); });
it("two concurrent replacements preserve the winner and compensate only the loser", async () => {
  let finishFirst!: (value: { count: number }) => void;
  m.store.mockResolvedValueOnce({ storagePath: path.replace("22222222-", "33333333-"), cardUrl: "first" })
    .mockResolvedValueOnce({ storagePath: path.replace("22222222-", "44444444-"), cardUrl: "second" });
  m.update.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
    .mockResolvedValueOnce({ count: 1 });
  const first = setCategoryCover("category", form());
  await vi.waitFor(() => expect(finishFirst).toBeTypeOf("function"));
  expect(await setCategoryCover("category", form())).toEqual({ ok: true, coverImageUrl: "second" });
  finishFirst({ count: 0 });
  expect(await first).toEqual(expect.objectContaining({ ok: false }));
  const cleaned = m.remove.mock.calls.flatMap(call => call[0]);
  expect(cleaned.some(ref => ref.path.includes("33333333-"))).toBe(true);
  expect(cleaned.some(ref => ref.path.includes("44444444-"))).toBe(false);
});
it("preserves the category persistence error if compensation also fails", async () => {
  const primary = new Error("primary");
  m.update.mockRejectedValue(primary);
  m.remove.mockRejectedValue(new Error("cleanup"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await setCategoryCover("category", form())).toEqual(expect.objectContaining({ ok: false }));
  expect(log).toHaveBeenCalledWith("Category cover compensation pending", expect.objectContaining({ categoryId: "category" }));
expect(log).toHaveBeenCalledWith("Category cover persistence failed", expect.objectContaining({ failure: "persistence" }));
  expect(JSON.stringify(log.mock.calls)).not.toContain("primary");
  log.mockRestore();
});

it("audits cover_set only when the compare-and-set wins", async () => {
  expect(await setCategoryCover("category", form())).toEqual(expect.objectContaining({ ok: true }));
  expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "u", entityType: "category", action: "cover_set" }) });
  m.audit.mockClear(); m.update.mockResolvedValue({ count: 0 });
  await setCategoryCover("category", form());
  expect(m.audit).not.toHaveBeenCalled();
});
