import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), aggregate: vi.fn(), create: vi.fn(), delete: vi.fn(), store: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/prisma/client", () => ({ prisma: { product: { findFirst: m.find }, productImage: { findUnique: m.find, aggregate: m.aggregate, create: m.create, delete: m.delete } } }));
vi.mock("@/lib/images/upload", async (original) => ({ ...await original<object>(), storeProcessedImage: m.store, removeStorageObjects: m.remove }));
vi.mock("@/lib/auth/supabase-env", () => ({ getSupabasePublicConfig: () => ({ url: "https://project.supabase.co" }) }));
import { addProductImage, removeProductImage } from "./actions";
const path = "originals/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";
const urls = Object.fromEntries(["thumb", "card", "detail", "og"].map(v => [`${v}Url`, `https://project.supabase.co/storage/v1/object/public/product-image-variants/${path.replace("originals/", "variants/")}-${v}.webp`]));
function form() { const f = new FormData(); f.set("file", new File(["test"], "test.png")); return f; }
beforeEach(() => { vi.resetAllMocks(); m.find.mockResolvedValue({ id: "image", storagePath: path, ...urls }); m.store.mockResolvedValue({ storagePath: path, ...urls }); m.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } }); });
it.each(["aggregate", "create"] as const)("compensates a failed %s and preserves the primary error", async (step) => { const error = new Error("database failed"); m[step].mockRejectedValue(error); expect(await addProductImage("p", form())).toEqual(expect.objectContaining({ ok: false, message: expect.any(String) })); expect(m.remove).toHaveBeenCalled(); });
it("does not touch Storage when unlink fails", async () => { m.delete.mockRejectedValue(new Error("database failed")); expect(await removeProductImage("image")).toEqual(expect.objectContaining({ ok: false })); expect(m.remove).not.toHaveBeenCalled(); });
it("unlinks before cleanup and reports pending cleanup", async () => { m.remove.mockImplementation(() => { expect(m.delete).toHaveBeenCalledWith({ where: { id: "image" } }); throw new Error("cleanup"); }); const log = vi.spyOn(console, "error").mockImplementation(() => {}); expect(await removeProductImage("image")).toEqual({ ok: true, cleanupPending: true }); expect(log).toHaveBeenCalled(); log.mockRestore(); });
it.each(["seed/product", path])("ignores external URLs even with path %s", async storagePath => { m.find.mockResolvedValue({ id: "image", storagePath, ...urls, thumbUrl: "https://external.test/photo" }); expect(await removeProductImage("image")).toEqual({ ok: true }); expect(m.remove).not.toHaveBeenCalled(); });
it("logs failed compensation without replacing database error", async () => { const error = new Error("primary"); m.create.mockRejectedValue(error); m.remove.mockRejectedValue(new Error("cleanup")); const log = vi.spyOn(console, "error").mockImplementation(() => {}); expect(await addProductImage("p", form())).toEqual(expect.objectContaining({ ok: false, message: expect.any(String) })); expect(log).toHaveBeenCalledWith("Product image persistence failed", expect.objectContaining({ failure: "persistence" }));
  expect(JSON.stringify(log.mock.calls)).not.toContain("primary");
  log.mockRestore(); });
