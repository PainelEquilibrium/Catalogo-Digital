import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  tx: {
    product: { findFirst: vi.fn(), deleteMany: vi.fn() },
    productImage: { deleteMany: vi.fn() },
    category: { findFirst: vi.fn(), deleteMany: vi.fn() },
    product_count: vi.fn(),
  },
  productCount: vi.fn(),
  enqueue: vi.fn(),
  drain: vi.fn(),
  audit: vi.fn(),
  objects: vi.fn(),
}));
vi.mock("@/lib/prisma/client", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown, _options?: unknown) => fn({ ...m.tx, product: { ...m.tx.product, count: m.productCount } }) },
}));
vi.mock("./storage-queue", () => ({ enqueueStorageDeletions: m.enqueue, drainStorageDeletions: m.drain }));
vi.mock("@/lib/audit/record", () => ({ recordAudit: m.audit }));
vi.mock("@/lib/images/upload", () => ({ storageObjectsForPersistedImage: m.objects }));
import { daysUntilPurge, purgeCategory, purgeProduct } from "./purge-trash";

const actor = { id: "u1", name: "Dono" };
const objs = [{ bucket: "product-images", path: "a" }];
beforeEach(() => {
  vi.resetAllMocks();
  m.objects.mockReturnValue(objs);
  m.tx.product.deleteMany.mockResolvedValue({ count: 1 });
  m.tx.category.deleteMany.mockResolvedValue({ count: 1 });
  m.drain.mockResolvedValue({ removed: 1, failed: 0 });
});

it("daysUntilPurge: 0 dias na lixeira = 30; 29 = 1; 31 = 0", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
  expect(daysUntilPurge(ago(0), now)).toBe(30);
  expect(daysUntilPurge(ago(29), now)).toBe(1);
  expect(daysUntilPurge(ago(31), now)).toBe(0);
});

it("purgeProduct apaga imagens e produto, enfileira objetos e audita 'purge'", async () => {
  m.tx.product.findFirst.mockResolvedValue({
    id: "p1", name: "Vestido", slug: "vestido", deletedAt: new Date(),
    images: [{ storagePath: "x", thumbUrl: "t", cardUrl: "c", detailUrl: "d", ogUrl: "o" }],
  });
  expect(await purgeProduct("p1", actor)).toBe("purged");
  expect(m.tx.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", deletedAt: { not: null } } }));
  expect(m.tx.productImage.deleteMany).toHaveBeenCalledWith({ where: { productId: "p1" } });
  expect(m.enqueue).toHaveBeenCalledWith(expect.anything(), objs);
  expect(m.audit).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ entityType: "product", entityId: "p1", entityLabel: "Vestido", action: "purge" }));
  expect(m.drain).toHaveBeenCalledWith({ paths: objs });
});

it("falha ao drenar não derruba o purge", async () => {
  m.tx.product.findFirst.mockResolvedValue({ id: "p1", name: "V", slug: "v", deletedAt: new Date(), images: [] });
  m.drain.mockRejectedValue(new Error("net"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await purgeProduct("p1", actor)).toBe("purged");
  log.mockRestore();
});

it("purgeCategory recusa com produto, mesmo na lixeira", async () => {
  m.tx.category.findFirst.mockResolvedValue({ id: "c1", name: "C", slug: "c", coverStoragePath: null, coverImageUrl: null, deletedAt: new Date() });
  m.productCount.mockResolvedValue(1);
  expect(await purgeCategory("c1", actor)).toBe("has_products");
  expect(m.productCount).toHaveBeenCalledWith({ where: { categoryId: "c1" } });
  expect(m.tx.category.deleteMany).not.toHaveBeenCalled();
  expect(m.audit).not.toHaveBeenCalled();
});

it("purgeCategory sem produtos apaga, enfileira a capa e audita", async () => {
  m.tx.category.findFirst.mockResolvedValue({ id: "c1", name: "C", slug: "c", coverStoragePath: "x", coverImageUrl: "u", deletedAt: new Date() });
  m.productCount.mockResolvedValue(0);
  expect(await purgeCategory("c1", actor)).toBe("purged");
  expect(m.enqueue).toHaveBeenCalledWith(expect.anything(), objs);
  expect(m.audit).toHaveBeenCalledWith(expect.anything(), actor, expect.objectContaining({ entityType: "category", action: "purge" }));
});

it("repetir purge devolve not_in_trash, sem erro", async () => {
  m.tx.product.findFirst.mockResolvedValue(null);
  m.tx.category.findFirst.mockResolvedValue(null);
  expect(await purgeProduct("p1", actor)).toBe("not_in_trash");
  expect(await purgeCategory("c1", actor)).toBe("not_in_trash");
  expect(m.audit).not.toHaveBeenCalled();
});
