import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), aggregate: vi.fn(), create: vi.fn(), delete: vi.fn(), audit: vi.fn(), store: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ requireAction: vi.fn() }));
vi.mock("@/lib/prisma/client", () => {
  const tx = { productImage: { aggregate: m.aggregate, create: m.create, delete: m.delete }, auditLog: { create: m.audit } };
  return { prisma: { product: { findFirst: m.find }, productImage: { findUnique: m.find }, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } };
});
vi.mock("@/lib/images/upload", async (original) => ({ ...await original<object>(), storeProcessedImage: m.store, removeStorageObjects: m.remove }));
vi.mock("@/lib/auth/supabase-env", () => ({ getSupabasePublicConfig: () => ({ url: "https://project.supabase.co" }) }));
import { requireAction } from "@/lib/auth/server";
import { addProductImage, removeProductImage } from "./actions";
const path = "originals/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";
const urls = Object.fromEntries(["thumb", "card", "detail", "og"].map(v => [`${v}Url`, `https://project.supabase.co/storage/v1/object/public/product-image-variants/${path.replace("originals/", "variants/")}-${v}.webp`]));
function form() { const f = new FormData(); f.set("file", new File(["test"], "test.png")); return f; }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(requireAction).mockResolvedValue({ userId: "u", email: "a@b.c", name: "Ana", role: "manager" }); m.create.mockResolvedValue({ id: "new-image" }); m.find.mockResolvedValue({ id: "image", name: "Produto", product: { id: "p", name: "Produto" }, storagePath: path, ...urls }); m.store.mockResolvedValue({ storagePath: path, ...urls }); m.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } }); });
it.each(["aggregate", "create"] as const)("compensates a failed %s and preserves the primary error", async (step) => { const error = new Error("database failed"); m[step].mockRejectedValue(error); expect(await addProductImage("p", form())).toEqual(expect.objectContaining({ ok: false, message: expect.any(String) })); expect(m.remove).toHaveBeenCalled(); });
it("does not touch Storage when unlink fails", async () => { m.delete.mockRejectedValue(new Error("database failed")); expect(await removeProductImage("image")).toEqual(expect.objectContaining({ ok: false })); expect(m.remove).not.toHaveBeenCalled(); });
it("unlinks before cleanup and reports pending cleanup", async () => { m.remove.mockImplementation(() => { expect(m.delete).toHaveBeenCalledWith({ where: { id: "image" } }); throw new Error("cleanup"); }); const log = vi.spyOn(console, "error").mockImplementation(() => {}); expect(await removeProductImage("image")).toEqual({ ok: true, cleanupPending: true }); expect(log).toHaveBeenCalled(); log.mockRestore(); });
it.each(["seed/product", path])("ignores external URLs even with path %s", async storagePath => { m.find.mockResolvedValue({ id: "image", product: { id: "p", name: "Produto" }, storagePath, ...urls, thumbUrl: "https://external.test/photo" }); expect(await removeProductImage("image")).toEqual({ ok: true }); expect(m.remove).not.toHaveBeenCalled(); });
it("logs failed compensation without replacing database error", async () => { const error = new Error("primary"); m.create.mockRejectedValue(error); m.remove.mockRejectedValue(new Error("cleanup")); const log = vi.spyOn(console, "error").mockImplementation(() => {}); expect(await addProductImage("p", form())).toEqual(expect.objectContaining({ ok: false, message: expect.any(String) })); expect(log).toHaveBeenCalledWith("Product image persistence failed", expect.objectContaining({ failure: "persistence" }));
  expect(JSON.stringify(log.mock.calls)).not.toContain("primary");
  log.mockRestore(); });

it("audits image add and remove with the actor, in the same transaction call", async () => {
  expect(await addProductImage("p", form())).toEqual({ ok: true });
  expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "u", actorName: "Ana", entityType: "image", entityId: "new-image", action: "image_add" }) });
  expect(await removeProductImage("image")).toEqual({ ok: true });
  expect(m.audit).toHaveBeenLastCalledWith({ data: expect.objectContaining({ entityId: "image", action: "image_remove" }) });
});
it("does not unlink when the audit write fails and leaves Storage alone", async () => { m.audit.mockRejectedValue(new Error("audit")); const log = vi.spyOn(console, "error").mockImplementation(() => {}); expect(await removeProductImage("image")).toEqual(expect.objectContaining({ ok: false })); expect(m.remove).not.toHaveBeenCalled(); log.mockRestore(); });
