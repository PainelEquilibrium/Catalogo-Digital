import { beforeEach, expect, it, vi } from "vitest";

const DAY = 86_400_000;
const now = new Date("2026-11-04T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * DAY);

type Row = { id: string; deletedAt: Date };
const m = vi.hoisted(() => ({
  products: [] as Row[],
  categories: [] as Row[],
  order: [] as string[],
  productCount: vi.fn(),
  auditRows: [] as Date[],
  failProduct: new Set<string>(),
}));

vi.mock("@/lib/prisma/client", () => {
  type Where = { deletedAt: { lte: Date } };
  const find = (name: "products" | "categories") => async ({ where }: { where: Where }) =>
    m[name].filter((r) => r.deletedAt <= where.deletedAt.lte).map((r) => ({ id: r.id }));
  const tx = {
    product: {
      count: m.productCount,
      findFirst: async ({ where }: { where: { id: string } }) => {
        if (m.failProduct.has(where.id)) throw new Error("boom");
        const p = m.products.find((r) => r.id === where.id);
        return p && { id: p.id, name: p.id, slug: p.id, deletedAt: p.deletedAt, images: [] };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        m.order.push(`product:${where.id}`);
        const before = m.products.length;
        m.products = m.products.filter((r) => r.id !== where.id);
        return { count: before - m.products.length };
      },
    },
    productImage: { deleteMany: async () => ({ count: 0 }) },
    category: {
      findFirst: async ({ where }: { where: { id: string } }) => {
        const c = m.categories.find((r) => r.id === where.id);
        return c && { id: c.id, name: c.id, slug: c.id, coverStoragePath: null, coverImageUrl: null, deletedAt: c.deletedAt };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        m.order.push(`category:${where.id}`);
        const before = m.categories.length;
        m.categories = m.categories.filter((r) => r.id !== where.id);
        return { count: before - m.categories.length };
      },
    },
  };
  return {
    prisma: {
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
      product: { findMany: find("products") },
      category: { findMany: find("categories") },
      auditLog: {
        deleteMany: async ({ where }: { where: { createdAt: { lt: Date } } }) => {
          const before = m.auditRows.length;
          m.auditRows = m.auditRows.filter((d) => !(d < where.createdAt.lt));
          return { count: before - m.auditRows.length };
        },
      },
    },
  };
});
vi.mock("./storage-queue", () => ({ enqueueStorageDeletions: vi.fn(), drainStorageDeletions: vi.fn() }));
vi.mock("@/lib/audit/record", () => ({ recordAudit: vi.fn(), SYSTEM_ACTOR: { id: null, name: "Sistema" } }));
vi.mock("@/lib/images/upload", () => ({ storageObjectsForPersistedImage: () => [] }));
import { pruneOldAudit, purgeExpiredTrash } from "./purge-trash";

beforeEach(() => {
  m.products = []; m.categories = []; m.order = []; m.auditRows = []; m.failProduct.clear();
  m.productCount.mockReset().mockResolvedValue(0);
});

it("item com 30 dias sai; com 29 fica", async () => {
  m.products = [{ id: "p30", deletedAt: ago(30) }, { id: "p29", deletedAt: ago(29) }];
  m.categories = [{ id: "c30", deletedAt: ago(30) }, { id: "c29", deletedAt: ago(29) }];
  expect(await purgeExpiredTrash(now)).toEqual({ products: 1, categories: 1, blocked: 0, failed: 0 });
  expect(m.products.map((p) => p.id)).toEqual(["p29"]);
  expect(m.categories.map((c) => c.id)).toEqual(["c29"]);
});

it("processa produtos antes de categorias", async () => {
  m.products = [{ id: "p1", deletedAt: ago(31) }];
  m.categories = [{ id: "c1", deletedAt: ago(31) }];
  m.productCount.mockImplementation(async () => m.products.length);
  expect(await purgeExpiredTrash(now)).toMatchObject({ products: 1, categories: 1, blocked: 0 });
  expect(m.order).toEqual(["product:p1", "category:c1"]);
});

it("categoria bloqueada conta em blocked, sem erro", async () => {
  m.categories = [{ id: "c1", deletedAt: ago(40) }];
  m.productCount.mockResolvedValue(2);
  expect(await purgeExpiredTrash(now)).toEqual({ products: 0, categories: 0, blocked: 1, failed: 0 });
});

it("rodar de novo não causa erro", async () => {
  m.products = [{ id: "p1", deletedAt: ago(40) }];
  await purgeExpiredTrash(now);
  expect(await purgeExpiredTrash(now)).toEqual({ products: 0, categories: 0, blocked: 0, failed: 0 });
});

it("falha em um produto não impede os outros e conta em failed", async () => {
  m.products = [{ id: "bad", deletedAt: ago(40) }, { id: "ok", deletedAt: ago(40) }];
  m.failProduct.add("bad");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await purgeExpiredTrash(now)).toMatchObject({ products: 1, failed: 1 });
  expect(log).toHaveBeenCalledWith("Purge product failed", { id: "bad" });
  log.mockRestore();
});

it("auditoria com mais de 12 meses sai; com 11 fica", async () => {
  const monthsAgo = (n: number) => { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - n); return d; };
  m.auditRows = [monthsAgo(13), monthsAgo(11)];
  expect(await pruneOldAudit(now)).toBe(1);
  expect(m.auditRows).toEqual([monthsAgo(11)]);
});
